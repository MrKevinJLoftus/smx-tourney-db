const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dbconn = require('../database/connector');
const queries = require('../queries/user');
const authError = new Error('Your email or password is incorrect.');

exports.userLogin = async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({message: 'Email and password are required.'});
  }
  console.log(`${req.body.email} logging in`);
  const fetchedUser = await dbconn.executeMysqlQuery(queries.FIND_USER_BY_EMAIL, [req.body.email]);
  if (!fetchedUser || fetchedUser.length < 1) {
    throw authError;
  }
  // found user
  const hashMatch = await bcrypt.compare(req.body.password, fetchedUser[0].hashed_pw);
  if (!hashMatch) {
    throw authError;
  }
  // hashes match, correct password entered
  // time to generate user's JWT
  const token = jwt.sign(
    {
      email: fetchedUser[0].username, userId: fetchedUser[0].id, isAdmin: fetchedUser[0].role === 'admin'
    },
    process.env.SMX_TDB_JWT_KEY,
    {
      expiresIn: '192h'
    }
  );
  console.log('login successful!');
  const isAdmin = fetchedUser[0].role === 'admin';
  res.status(200).json({
    token: token,
    expiresIn: 691200,
    userId: fetchedUser[0].id,
    isAdmin: isAdmin
  });
}

exports.createUser = async (req, res) => {
  // create a new user and store it in the database
  if (!req.body.email || !req.body.password) {
    return res.status(400).json({message: 'Email and password are required.'});
  }
  const username = req.body.email;
  console.log(`creating new user ${username}`);
  
  // Check if user with this email already exists
  const existing = await dbconn.executeMysqlQuery(queries.FIND_USER_BY_EMAIL, [username]);
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'User with this email already exists' });
  }
  
  const hash = await bcrypt.hash(req.body.password, 15)
  const createUserRes = await dbconn.executeMysqlQuery(queries.CREATE_USER, [username, hash]);
  const newUserId = createUserRes.insertId;
  const newUser = await dbconn.executeMysqlQuery(queries.GET_USER_BY_ID, [newUserId]);
  console.log(`new user created: ${JSON.stringify(newUser)}`);
  const isAdmin = newUser[0].role === 'admin';
  const token = jwt.sign(
    {
      email: newUser[0].username, userId: newUser[0].id, isAdmin: isAdmin
    },
    process.env.SMX_TDB_JWT_KEY,
    { expiresIn: '192h' }
  );
  res.status(200).json({token: token, expiresIn: 691200, userId: newUser[0].id, isAdmin: isAdmin});
};

exports.updatePassword = async (req, res) => {
  // Update user's password
  // req.userData is set by check-auth middleware
  const userId = req.userData.userId;
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({message: 'Current password and new password are required.'});
  }

  // Fetch the user to verify current password
  const user = await dbconn.executeMysqlQuery(queries.GET_USER_BY_ID, [userId]);
  if (!user || user.length < 1) {
    return res.status(404).json({message: 'User not found.'});
  }

  // Verify current password
  const hashMatch = await bcrypt.compare(currentPassword, user[0].hashed_pw);
  if (!hashMatch) {
    return res.status(401).json({message: 'Current password is incorrect.'});
  }

  // Hash new password and update
  const newHash = await bcrypt.hash(newPassword, 15);
  await dbconn.executeMysqlQuery(queries.UPDATE_PASSWORD, [newHash, userId]);
  
  console.log(`Password updated for user ${userId}`);
  res.status(200).json({message: 'Password updated successfully.'});
};
