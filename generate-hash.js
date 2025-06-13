const bcrypt = require('bcryptjs');

const password = '123456';
const saltRounds = 12;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) throw err;
    console.log('Hash para 123456:', hash);
}); 