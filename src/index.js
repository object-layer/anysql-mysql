'use strict';

import mysql from 'mysql-as-promised';
import sleep from 'sleep-promise';

export class AnySQLMySQL {
  constructor(url) {
    this.pool = mysql.createPool(url);
    this.pool.on('connection', function(connection) {
      let sql = 'SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE';
      connection.query(sql);
    });
  }

  query(sql, values) {
    return this.pool.query(sql, values);
  }

  async transaction(fn) {
    let connection = await this.pool.getConnection();
    try {
      let retries = 0;
      while (retries < 30) {
        await connection.query('START TRANSACTION');
        try {
          let result = await fn({
            query(sql, values) {
              return connection.query(sql, values);
            },
            transaction(fn) {
              return fn(this);
            }
          });
          await connection.query('COMMIT');
          return result;
        } catch (err) {
          await connection.query('ROLLBACK');
          if (err.errno === 1205 || err.errno === 1213) {
            retries++;
            await sleep(100);
            continue; // retry the transaction
          }
          throw err;
        }
      }
      throw new Error('Too many transaction retries');
    } finally {
      connection.release();
    }
  }

  end() {
    return this.pool.end();
  }
}

export default AnySQLMySQL;
