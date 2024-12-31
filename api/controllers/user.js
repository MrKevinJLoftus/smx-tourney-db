const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbconn = require('../utilities/database_connectors');
const queries = require('../queries/user');
const authError = new Error('Your username or password is incorrect.');

exports.userLogin = async (req, res) => {
  console.log(`${req.body.username} logging in`);
  const fetchedUser = await dbconn.executeMysqlQuery(queries.FIND_USER_BY_USERNAME, [req.body.username]);
  if (!fetchedUser || fetchedUser.length < 1) {
    throw authError;
  }
  // found user
  const hashMatch = await bcrypt.compare(req.body.password, fetchedUser[0].password);
  if (!hashMatch) {
    throw authError;
  }
  // hashes match, correct password entered
  // time to generate user's JWT
  const token = jwt.sign(
    {
      username: fetchedUser[0].username, userId: fetchedUser[0].user_id, isAdmin: fetchedUser[0].isAdmin === 1
    },
    process.env.SMX_TDB_JWT_KEY,
    {
      expiresIn: '192h'
    }
  );
  console.log('login successful!');
  res.status(200).json({
    token: token,
    expiresIn: 14400,
    userId: fetchedUser[0].user_id
  });
}

exports.createUser = async (req, res) => {
  // create a new user and store it in the database
  console.log(`creating new user ${req.body.username}`);
  const hash = await bcrypt.hash(req.body.password, 15)
  const newUser = await dbconn.executeMysqlQuery(queries.CREATE_USER, [req.body.username, hash]);
  const token = jwt.sign({username: newUser[0].username, userId: newUser[0].user_id},
    process.env.JWT_KEY,
    { expiresIn: '192h' }
  );
  res.status(200).json({
    token: token,
    expiresIn: 3600,
    userId: newUser[0].user_id
  });
}

