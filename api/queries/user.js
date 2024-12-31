module.exports = {
  FIND_USER_BY_USERNAME: `select * from users where username = ?`,
  CREATE_USER: `insert into
    users (username, password, isAdmin)
    values (?, ?, 0)`
}