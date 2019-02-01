require('dotenv').config()
const restify = require('restify')
const HttpStatus = require('http-status-codes')
const shortid = require('shortid')
const corsMiddleware = require('restify-cors-middleware')

const connectRunClose = require('./connectRunClose')

const server = restify.createServer()

server.use(restify.plugins.bodyParser())

// Enable CORS
const cors = corsMiddleware({
  preflightMaxAge: 5,
  origins: ['*'],
  allowHeaders: ['API-Token'],
  exposeHeaders: ['API-Token-Expiry']
})

server.pre(cors.preflight)
server.use(cors.actual)

/*
Data types:

 - A player is an object like this:
   {
     _id: <MongoDB document ID>
     playerId: 'IyNUaA1Ya',
     name: 'Lieutenant Data',
     rank: 6
   }

*/

// Health
server.get('/api/health', (req, res, next) => {
  res.send(HttpStatus.OK, 'App is okay.')
  next()
})

const getSortedPlayers = async () => {
  return await connectRunClose('players', players => players.find({}, { sort:  [['rank', 1]] }).toArray())
}

// Get all players
server.get('/api/players', async (req, res, next) => {
  const players = await getSortedPlayers()
  res.send(HttpStatus.OK, players)
  next()
})

// Create player
server.post('/api/players', async (req, res, next) => {
  if (!req.body) {
    res.send(HttpStatus.BAD_REQUEST, 'Name is missing.')
    next()
    return
  }

  const { name } = req.body
  if (name.trim().length === 0) {
    res.send(HttpStatus.BAD_REQUEST, 'Name is empty.')
    next()
    return
  }

  const playerId = shortid.generate()
  const players = await getSortedPlayers()
  const rank = players.length + 1
  const result = await connectRunClose('players', players => players.insertOne({ playerId, name, rank }))
  if (result.result.ok === 1) {
    res.send(HttpStatus.CREATED, { playerId })
    next()
    return
  }
  res.send(HttpStatus.INTERNAL_SERVER_ERROR)
  next()
})

// Swap ranks
server.post('/api/swap', async (req, res, next) => {
  if (!req.body) {
    res.send(HttpStatus.BAD_REQUEST, 'Player IDs are missing.')
    next()
    return
  }

  const { player1Id, player2Id } = req.body
  if (!player1Id || !player2Id) {
    res.send(HttpStatus.BAD_REQUEST, 'Missing player IDs.')
    next()
    return
  }

  const player1 = await connectRunClose('players', players => players.findOne({ playerId: player1Id }))
  const player2 = await connectRunClose('players', players => players.findOne({ playerId: player2Id }))
  const player1Rank = player1.rank
  const player2Rank = player2.rank

  await connectRunClose('players', players => players.updateOne(
    { playerId: player1Id },
    { $set: { rank: player2Rank } }))
  await connectRunClose('players', players => players.updateOne(
    { playerId: player2Id },
    { $set: { rank: player1Rank } }))
  res.send(HttpStatus.NO_CONTENT)
  next()
})

// Clean up ranks
const cleanUpRanks = async () => {
  const players = await getSortedPlayers()
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const { playerId } = player;
    await connectRunClose('players', players => players.updateOne(
      { playerId },
      { $set: { rank: i + 1 } }))
  }
}

// Delete specific player
server.del('/api/players/:playerId', async (req, res, next) => {
  const { playerId } = req.params
  await connectRunClose('players', players => players.deleteOne({ playerId }))
  await cleanUpRanks()
  res.send(HttpStatus.NO_CONTENT)
  next()
})

let port = process.env.PORT
if (port == null || port === '') {
  port = 8000
}

server.listen(port, function () {
  console.info('%s listening at %s', server.name, server.url)
})
