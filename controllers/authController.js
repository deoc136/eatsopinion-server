const fsPromises = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require("../db");
require('dotenv').config();

const handleLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ 'message': 'Email and password are required.' });
    console.log(email)
    //try {
        const foundUser = await pool.query( `
                    SELECT 
                u.userid, 
                u.username, 
                u.city, 
                u.useremail, 
                u.usergender, 
                u.password, 
                u.phone, 
                r.restaurantid 
            FROM 
                public.users AS u
            LEFT JOIN 
                public.restaurants AS r ON u.userid = r.userid
            WHERE 
                u.useremail = $1;`, [email]);
        if (foundUser.rowCount === 0) {
            return res.sendStatus(401); // Unauthorized
        }

        const match = await bcrypt.compare(password, foundUser.rows[0].password);

        if (match) {
            req.session.user = {
                id: foundUser.rows[0].userid,
                username: foundUser.rows[0].username,
                email: foundUser.rows[0].useremail,
                restaurantid: foundUser.rows[0].restaurantid // assuming you have this field
            };
            res.json({'success': 'Logged in successfully'});
        } else {
            
            res.sendStatus(401); // Unauthorized
        }
        /*
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ 'message': err.message });
    }*/
}


module.exports = { handleLogin };


