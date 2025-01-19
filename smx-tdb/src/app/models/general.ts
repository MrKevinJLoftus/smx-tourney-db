export interface Route {
  url: string;
  text: string;
  icon?: string;
}

export enum MessageType {
  ERROR,
  INFO,
  SUCCESS
}

export interface AuthData {
  username: string;
  password: string;
}
