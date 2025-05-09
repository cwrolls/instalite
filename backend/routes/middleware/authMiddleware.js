function isAuthenticated(req, res, next) {
    if (req.session && req.session.user && req.session.user.userId) {
      // user is authenticated
      return next();
    } else {
      // user is not authenticated
      return res.status(401).json({ error: 'Unauthorized: You must be logged in to access this resource.' });
    }
  }
  
  module.exports = { isAuthenticated };