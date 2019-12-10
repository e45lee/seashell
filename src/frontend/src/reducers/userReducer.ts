import {evolve} from "ramda";
import {Action} from "redux";

export interface userReducerState {
  [key: string]: any;
  questid?: string;
  busy: boolean;
};

export interface userReducerAction extends Action {
  type: string;
  payload: string;
};

export const userActions = {
  INVALIDATE: "USER_INVALIDATE",
  SIGNIN: "USER_SIGNIN",
  SIGNOUT: "USER_SIGNOUT",
  BUSY: "LOGIN_BUSY",
  NOTBUSY: "LOGIN_NOTBUSY"
};

export default function userReducer(state: userReducerState = {questid: undefined, busy: false}, action: userReducerAction): userReducerState {
  switch (action.type) {
    case userActions.INVALIDATE:
      return {questid: undefined, busy: false};
    case userActions.SIGNIN:
      return {questid: action.payload, busy: false};
    case userActions.SIGNOUT:
      return {questid: undefined, busy: false};
    case userActions.BUSY:
      return {questid: state.questid, busy: true};
    case userActions.NOTBUSY:
      return {questid: state.questid, busy: false};
    default:
      return state;
  }
}
