const mysql = require('mysql');

function createConnection() {
  return mysql.createConnection({
    host: process.env.CLEARDB_HOST,
    user: process.env.CLEARDB_USER,
    password: process.env.CLEARDB_PASS,
    database: process.env.CLEARDB_DB,
  });
}

function queryOnConnection(connection, query, params) {
  return new Promise((resolve, reject) => {
    connection.query(query, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

/**
 * Execute a query. Pass an optional `connection` (e.g. from `withTransaction`) to run on that connection without closing it.
 * @param {string} query
 * @param {Array} [params]
 * @param {import('mysql').Connection} [connection]
 */
exports.executeMysqlQuery = async (query, params, connection) => {
  const p = params !== undefined && params !== null ? params : [];
  if (connection) {
    console.log(
      `Querying MySQL (tx): ${query}${p.length ? ` with params ${p.join()}` : ''}`
    );
    return queryOnConnection(connection, query, p);
  }
  return new Promise((resolve, reject) => {
    const conn = createConnection();
    console.log(
      `Querying MySQL: ${query}${p.length ? ` with params ${p.join()}` : ''}`
    );
    conn.query(query, p, (error, results) => {
      if (error) {
        console.error(error);
        conn.end();
        reject(error);
      } else {
        conn.end();
        resolve(results);
      }
    });
  });
};

/**
 * Run `fn(connection)` inside BEGIN … COMMIT, or ROLLBACK on throw/reject.
 * @template T
 * @param {(connection: import('mysql').Connection) => Promise<T>} fn
 * @returns {Promise<T>}
 */
exports.withTransaction = async (fn) => {
  const connection = createConnection();
  return new Promise((resolve, reject) => {
    connection.beginTransaction((err) => {
      if (err) {
        connection.end();
        return reject(err);
      }
      Promise.resolve(fn(connection))
        .then((result) => {
          connection.commit((cerr) => {
            if (cerr) {
              return connection.rollback(() => {
                connection.end();
                reject(cerr);
              });
            }
            connection.end();
            resolve(result);
          });
        })
        .catch((e) => {
          connection.rollback(() => {
            connection.end();
            reject(e);
          });
        });
    });
  });
};
