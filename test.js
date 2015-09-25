'use strict';

import { assert } from 'chai';
import AnySQLMySQL from './src';

async function catchError(fn) {
  let err;
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  return err;
}

describe('anysql-mysql', function() {
  let mysql;

  before(function() {
    mysql = new AnySQLMySQL('mysql://test@localhost/test');
  });

  it('should perform a simple operation', async function() {
    let rows = await mysql.query('SELECT ? + ? AS solution', [2, 3]);
    assert.strictEqual(rows[0].solution, 5);
  });

  describe('transactions', function() {
    before(async function() {
      await mysql.query('CREATE TABLE people (name TEXT, age INTEGER)');
    });

    it('should commit the transaction when no error occurs', async function() {
      await mysql.query('INSERT INTO people (name, age) VALUES (?, ?)', ['Jean Dupont', 33]);
      let rows, person;
      await mysql.transaction(async function(mysql) {
        rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Jean Dupont');
        person = rows[0];
        assert.deepEqual(person, { name: 'Jean Dupont', age: 33 });
        await mysql.query('UPDATE people SET age=? WHERE name=?', [person.age + 1, person.name]);
        rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Jean Dupont');
        person = rows[0];
        assert.deepEqual(person, { name: 'Jean Dupont', age: 34 });
      });
      rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Jean Dupont');
      person = rows[0];
      assert.deepEqual(person, { name: 'Jean Dupont', age: 34 });
    });

    it('should rollback the transaction when an error occurs', async function() {
      await mysql.query('INSERT INTO people (name, age) VALUES (?, ?)', ['Pierre Durand', 23]);
      let rows, person;
      let err = await catchError(async function() {
        await mysql.transaction(async function(mysql) {
          rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Pierre Durand');
          person = rows[0];
          assert.deepEqual(person, { name: 'Pierre Durand', age: 23 });
          await mysql.query('UPDATE people SET age=? WHERE name=?', [person.age + 1, person.name]);
          rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Pierre Durand');
          person = rows[0];
          assert.deepEqual(person, { name: 'Pierre Durand', age: 24 });
          throw new Error('something is wrong');
        });
      });
      assert.instanceOf(err, Error);
      rows = await mysql.query('SELECT * FROM people WHERE name=?', 'Pierre Durand');
      person = rows[0];
      assert.deepEqual(person, { name: 'Pierre Durand', age: 23 });
    });

    after(async function() {
      await mysql.query('DROP TABLE people');
    });
  });

  after(async function() {
    await mysql.end();
  });
});
