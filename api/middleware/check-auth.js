const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  // token is the value of 'authorization' http header
  // format "Bearer abcd1234..."
  // split on the white space to grab the token value
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({message: "Authorization failed!"});
    }
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token,
      process.env.SMX_TDB_JWT_KEY
    );
    req.userData = {userId: decodedToken.userId, email: decodedToken.email};
    // if code gets here with no errors thrown, token is present and valid
    next();
  } catch (error) {
    res.status(401).json({message: "Authorization failed!"});
  }
}
