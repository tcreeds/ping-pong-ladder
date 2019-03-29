import ActionType from './actions/ActionType';

const reducers = (state = {}, action) => {
  switch (action.type) {
    case ActionType.SET_PLAYERS:
      const { players } = action;
      return {
        ...state,
        players,
      };
    case ActionType.SET_PLAYER_SWAPS:
      const { playerSwaps } = action;
      return {
        ...state,
        playerSwaps,
      };
    case ActionType.SET_IS_LOADING:
      const { isLoading } = action;
      return {
        ...state,
        isLoading,
      };
    default:
      return state;
  }
};

export default reducers;
