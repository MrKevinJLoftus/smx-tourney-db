module.exports = {
  FIND_USER_BY_EMAIL: `select * from user where username = ?`,
  CREATE_USER: `insert into
    user (username, hashed_pw, role)
    values (?, ?, 0)`,
  GET_USER_BY_ID: `select * from user where id = ?`,
  UPDATE_PASSWORD: `update user set hashed_pw = ? where id = ?`
}