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
  email: string;
  password: string;
}
