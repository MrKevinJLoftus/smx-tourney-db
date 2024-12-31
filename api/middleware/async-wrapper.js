module.exports = (ftn) => (req, res, next) => {
  Promise.resolve(ftn(req, res, next))
    .catch(next);
};
