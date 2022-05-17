/* Copyright (c) 2019, 2022, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   plsqlrecord.js
 *
 * DESCRIPTION
 *   Shows binding of PL/SQL RECORDS
 *
 *   This example requires node-oracledb 4 or later.
 *
 *   This example uses Node 8's async/await syntax.
 *
 *****************************************************************************/

'use strict';

const fs = require('fs');
const oracledb = require('oracledb');
const dbConfig = require('./dbconfig.js');

// On Windows and macOS, you can specify the directory containing the Oracle
// Client Libraries at runtime, or before Node.js starts.  On other platforms
// the system library search path must always be set before Node.js is started.
// See the node-oracledb installation documentation.
// If the search path is not correct, you will get a DPI-1047 error.
let libPath;
if (process.platform === 'win32') {           // Windows
  libPath = 'C:\\oracle\\instantclient_19_12';
} else if (process.platform === 'darwin') {   // macOS
  libPath = process.env.HOME + '/Downloads/instantclient_19_8';
}
if (libPath && fs.existsSync(libPath)) {
  oracledb.initOracleClient({ libDir: libPath });
}

async function run() {
  let connection, binds, options, result, obj;

  // The PL/SQL that is called in each example
  const plsql = `CALL rectest.myproc(:inbv, :outbv)`;

  try {

    connection = await oracledb.getConnection(dbConfig);

    //
    // Create a PL/SQL package that uses a RECORD
    //

    const stmts = [
      `CREATE OR REPLACE PACKAGE rectest AS
         TYPE rectype IS RECORD (name VARCHAR2(40), pos NUMBER);
         PROCEDURE myproc (p_in IN rectype, p_out OUT rectype);
       END rectest;`,

      `CREATE OR REPLACE PACKAGE BODY rectest AS
         PROCEDURE myproc (p_in IN rectype, p_out OUT rectype) AS
         BEGIN
           p_out := p_in;
           p_out.pos := p_out.pos * 2;
         END;
       END rectest;`
    ];

    for (const s of stmts) {
      try {
        await connection.execute(s);
      } catch (e) {
        console.error(e);
      }
    }


    //
    // Get the RECORD prototype object
    //

    const RecTypeClass = await connection.getDbObjectClass("RECTEST.RECTYPE");
    // console.log(RecTypeClass.prototype);


    //
    // Single execution
    //

    console.log('Using the constructor to create an object:');
    obj = new RecTypeClass({ NAME: 'Ship', POS: 12 });

    binds = {
      inbv: obj,
      outbv: { type: RecTypeClass, dir: oracledb.BIND_OUT }
    };

    result = await connection.execute(plsql, binds);
    console.log(result.outBinds.outbv);

    console.log('\nBinding the record values directly:');

    binds = {
      inbv: { type: RecTypeClass, val: { NAME: 'Plane', POS: 34 } },
      outbv: { type: RecTypeClass, dir: oracledb.BIND_OUT }
    };

    result = await connection.execute(plsql, binds);
    console.log(result.outBinds.outbv);

    // Using the name for the type
    binds = {
      inbv: { type: "RECTEST.RECTYPE", val: { NAME: 'Car', POS: 56 } },
      outbv: { type: RecTypeClass, dir: oracledb.BIND_OUT }
    };

    result = await connection.execute(plsql, binds);
    console.log(result.outBinds.outbv);

    //
    // executeMany()
    //

    console.log('\nExample with executeMany():');

    binds = [
      { inbv: { NAME: 'Train', POS: 78 } },
      { inbv: { NAME: 'Bike', POS: 83 } }
    ];

    options = {
      bindDefs: {
        inbv: { type: RecTypeClass },
        outbv: { type: RecTypeClass, dir: oracledb.BIND_OUT },
      }
    };

    result = await connection.executeMany(plsql, binds, options);
    for (const b of result.outBinds) {
      console.log(b.outbv);
    }

  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

run();
