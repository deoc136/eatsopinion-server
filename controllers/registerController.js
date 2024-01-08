const fsPromises = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require("../db");


const handleNewUser = async (req, res) => {
    const { name } = req.body;
    const { phone } = req.body;
    const { email } = req.body;
    const { password } = req.body;
    if (!email || !password || !name) return res.status(400).json({ 'message': 'nombre, correo y contraseña obligatorios.' });
    // check for duplicate usernames in the db
    const duplicateCheck = await pool.query("SELECT * FROM public.users WHERE useremail = $1", [email]);
    if (duplicateCheck.rows.length) {
        return res.status(409).json({ 'message': 'El correo ya está en uso.' }); // Conflict
    }
    try {
        //encrypt the password
        const hashedPwd = await bcrypt.hash(password, 10);
        //store the new user
        const newUser = await pool.query("INSERT INTO public.users (username, phone, useremail, password ) VALUES($1,$2,$3,$4) RETURNING *",
        [name, phone, email, hashedPwd ]);
        const insertedId = newUser.rows[0].userid;
        console.log(insertedId);
        res.status(201).json({ 'success': `New user ${name} created!` });
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }

}

module.exports = { handleNewUser };
