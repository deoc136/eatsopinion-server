const express = require('express');
const app = express();
const user = require('./routes/user');
const bcrypt = require('bcrypt');
const cors = require('cors');
const pool = require("./db");
const multer = require('multer')
const path = require('path');
const session = require('express-session');
const fs = require('fs'); 
const pgSession = require('connect-pg-simple')(session);
require('dotenv').config();



app.use(session({
    store: new pgSession({
        pool : pool, // Use existing postgres pool
        tableName : 'session' // Use a custom table name. Default is 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Change to true if you want to save uninitialized session
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));



app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// Middleware to get the max restaurantId
async function getMaxRestaurantId(req, res, next) {
    try {
        const result = await pool.query('SELECT MAX(restaurantid) AS maxid FROM public.restaurants');
        const maxId = result.rows[0].maxid;
        req.maxRestaurantId = maxId;
        console.log("Max ID print:", maxId);

        const restaurantFolderPath = path.join(__dirname, 'public', 'Images', 'restaurants', String(maxId));
        const resFolderPath = path.join(restaurantFolderPath, 'res');

        // Create directories if they don't exist
        [restaurantFolderPath, resFolderPath].forEach(folderPath => {
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
        });

        next();
    } catch (error) {
        console.error('Error fetching max restaurantId:', error);
        res.status(500).send('Internal Server Error');
    }
}


// Simplified Login Route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ 'message': 'Email and password are required.' });
    }

    try {
        const foundUser = await pool.query(`
            SELECT u.userid, u.username, u.city, u.useremail, u.usergender, u.password, u.phone, r.restaurantid
            FROM public.users AS u
            LEFT JOIN public.restaurants AS r ON u.userid = r.userid
            WHERE u.useremail = $1;
        `, [email]);

        if (foundUser.rowCount === 0) {
            return res.sendStatus(401); // Unauthorized
        }

        const match = await bcrypt.compare(password, foundUser.rows[0].password);
        if (match) {
            req.session.user = {
                id: foundUser.rows[0].userid,
                username: foundUser.rows[0].username,
                email: foundUser.rows[0].useremail,
                restaurantid: foundUser.rows[0].restaurantid
            };
            res.json({ 'success': 'Logged in successfully' });
        } else {
            res.sendStatus(401); // Unauthorized
        }
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).send("Server error");
    }
});

const storage = multer.diskStorage({
    destination: './public/Images/restaurants',
    filename: function(req, file, cb) {
        const maxId = String(req.maxRestaurantId); // Incrementing to use as the new restaurantId
        console.log("Max ID:", maxId);
        const fileExtension = path.extname(file.originalname);
        cb(null, maxId + "/"+ file.originalname);
    }
});

const upload = multer({ storage });

app.post('/upload', getMaxRestaurantId, upload.single('image'), (req, res) => {
    if (req.file) {
        console.log("File uploaded:", req.file);
        res.json({ imageUrl: `/Images/restaurants/${req.file.filename}` });
    } else {
        res.status(400).send("No file uploaded.");
    }
});



const multipleStorage = multer.diskStorage({
    destination: function(req, file, cb) {
        const maxId = String(req.maxRestaurantId);
        const dir = `./public/Images/restaurants/${maxId}/res`;
        fs.mkdirSync(dir, { recursive: true }); // Ensure directory exists
        cb(null, dir);
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname); // Use original file name
    }
});

const multipleUpload = multer({ storage: multipleStorage });

app.post('/uploadMultiple', getMaxRestaurantId, multipleUpload.array('resImages'), (req, res) => {
    if (req.files) {
        console.log("Files uploaded:", req.files);
        const imageUrls = req.files.map(file => `/Images/restaurants/${req.maxRestaurantId}/res/${file.filename}`);
        res.json({ imageUrls });
    } else {
        res.status(400).send("No files uploaded.");
    }
});




const foodImageUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = `./public/Images/restaurants/food`;
            fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    })
}).single('foodImage');

app.post('/foodadd', foodImageUpload, async (req, res) => {
    const { restaurantId, foodName, foodType, foodCategory, foodDesc, foodPrice } = req.body;
    const foodImage = req.file ? req.file.filename : null;

    try {
        const newFood = await pool.query(`
            INSERT INTO public.food 
            (restaurantid, foodname, foodtype, foodcategory, price, description, image) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`,
            [restaurantId, foodName, foodType, foodCategory, foodPrice, foodDesc, foodImage]
        );
        res.json(newFood.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error saving food item');
    }
});




//ROUTES
// Serve static files from public/Images
app.use('/images', express.static(path.join(__dirname, 'public', 'Images')));


app.get('/restaurant-images/:id', (req, res) => {
    const restaurantId = req.params.id;
    const dirPath = path.join(__dirname, 'public', 'Images', 'restaurants', restaurantId,'res');

    fs.readdir(dirPath, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error reading directory');
        }
        res.json(files);
    });
});


//Create or post a Restaurant
app.post("/resadd", async (req, res) => {

    const { restaurantname } = req.body;
    const { address } = req.body;
    const { phone } = req.body;
    const { scheduler } = req.body;
    const { city } = req.body;
    const { webpage } = req.body;
    const { short_desc } = req.body;
    const { nit } = req.body;
    const { menu } = req.body;
    const { logoname } = req.body;
    const {id} =req.body
    const newRes = await pool.query("INSERT INTO public.restaurants(restaurantname, address, phone, scheduler, city, webpage, short_desc, nit, menu, userid, logo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
        [restaurantname, address, phone, scheduler, city, webpage, short_desc, nit, menu, id, logoname ]);
    const insertedId = newRes.rows[0].restaurantid;
    res.json({ restaurantId: insertedId });
    console.log(insertedId);

});




app.post("/foodadd", async (req, res) => {

    const { restaurantid } = req.body;
    const { foodName } = req.body;
    const { foodType } = req.body;
    const { foodCategory } = req.body;
    const { foodDesc } = req.body;
    const{foodPrice}=req.body;
    const newRes = await pool.query("INSERT INTO public.food(restaurantid, foodname, foodtype, foodcategory, price, description) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [restaurantid, foodName, foodType, foodCategory, foodPrice, foodDesc ]);
    const insertedId = newRes.rows[0].foodid;
    res.json({ foodid: insertedId });
    console.log(insertedId);

});




//Create or post a Survey
app.post("/surveyAdd", async (req, res) => {

    const { platoRateData } = req.body;
    const { foodRating } = req.body;
    const { foodComment } = req.body;
    const { serviceRating } = req.body;
    const { serviceComment } = req.body;
    const { environmentRating } = req.body;
    const { environmentComment } = req.body;
    const { userid } = req.body;
    const { id } = req.body;
    const newRes = await pool.query("INSERT INTO public.surveys (restaurantid, ratingfood, ratingservice, ratingenvironment, foodComment, serviceComment, environmentComment, userid) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [id, foodRating, serviceRating, environmentRating, foodComment, serviceComment, environmentComment, userid]);
    const insertedId = newRes.rows[0].surveyid;
    res.json(newRes.rows[0]);
    console.log(newRes.rows[0]);
    //console.log(insertedId);
    for (const plato of platoRateData) {
        const { nombrePlato, idPlato, ratePlato, commentPlato } = plato;
        console.log(idPlato);
        const newPlatoRate = await pool.query("INSERT INTO public.foodratings (surveyid, foodid, foodrating, foodcomment) VALUES ($1,$2,$3,$4) RETURNING *",
            [insertedId, idPlato, ratePlato, commentPlato]);
        console.log(newPlatoRate.rows[0]);
    }
});




app.use('/register', require('./routes/register'));






app.get('/getUser', (req, res) => {
    console.log('Session data:', req.session); // Additional logging
    if (req.session.user) {
        res.json(req.session.user);
        console.log(req.session.user)
    } else {
        res.sendStatus(401); // Unauthorized
    }
});


//This have to be updated in the back-end
app.get('/restaurants-with-likes', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const userId = req.session.user.id;
        const restaurantsWithLikes = await pool.query(`
            SELECT r.*, 
                   CASE WHEN l.userid IS NOT NULL THEN TRUE ELSE FALSE END as is_favorite
            FROM public.restaurants r
            LEFT JOIN public.likes l ON r.restaurantid = l.restaurantid AND l.userid = $1;
        `, [userId]);

        res.json(restaurantsWithLikes.rows);
    } catch (error) {
        console.error('Error fetching restaurants with likes:', error);
        res.status(500).send('Internal Server Error');
    }
});



//This has to be changed in the server
app.get("/res", async (req, res) => {
    const userId = req.session.user ? req.session.user.id : null;

    try {
        const restaurants = await pool.query(`
            SELECT 
                r.*, 
                CASE WHEN l.userid IS NOT NULL THEN true ELSE false END AS is_favorite,
                STRING_AGG(f.foodcategory, ', ') AS food_categories,
                ROUND((AVG(s.ratingfood) + AVG(s.ratingservice) + AVG(s.ratingenvironment)) / 3, 1) AS overall_average
            FROM 
                public.restaurants r
            LEFT JOIN 
                public.food f ON r.restaurantid = f.restaurantid
            LEFT JOIN 
                public.surveys s ON r.restaurantid = s.restaurantid
            LEFT JOIN 
                public.likes l ON r.restaurantid = l.restaurantid AND l.userid = $1
            GROUP BY 
                r.restaurantid, l.userid
            ORDER BY
                overall_average DESC;
        `, [userId]);
        res.json(restaurants.rows);
    } catch (error) {
        console.error("Error fetching restaurants:", error);
        res.status(500).send("Server error");
    }
});



app.post("/toggle-like", async (req, res) => {
    if (!req.session.user) {
        return res.sendStatus(401); // Unauthorized if not logged in
    }

    const { restaurantId } = req.body;
    const userId = req.session.user.id;

    try {
        // Check if like already exists
        const existingLike = await pool.query(`
            SELECT * FROM public.likes WHERE userid = $1 AND restaurantid = $2;
        `, [userId, restaurantId]);

        if (existingLike.rowCount > 0) {
            // Remove like
            await pool.query(`
                DELETE FROM public.likes WHERE userid = $1 AND restaurantid = $2;
            `, [userId, restaurantId]);
        } else {
            // Add like
            await pool.query(`
                INSERT INTO public.likes (userid, restaurantid) VALUES ($1, $2);
            `, [userId, restaurantId]);
        }

        res.json({ message: 'Toggle like successful' });
    } catch (error) {
        console.error("Error toggling like:", error);
        res.status(500).send("Server error");
    }
});







// Get the data for the specific restaurant 
app.get("/reporte/:resid", async (req, res) => {
    // Retrieve startDate and endDate from the query parameters
    const { startDate, endDate } = req.query;
    const { resid } = req.params;
    try {
        const report = await pool.query(`
            SELECT DATE(created_at) AS created_at, ROUND(AVG(ratingfood),1) AS avg_comida, ROUND(AVG(ratingservice),1) AS avg_servicio, ROUND(AVG(ratingenvironment),1) AS avg_entorno, COUNT(surveyid) AS cant_encuestas
            FROM public.surveys
            WHERE DATE(created_at) >= $1 AND DATE(created_at) <= $2 AND restaurantid = $3
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at);
        `, [startDate, endDate, parseInt(resid)]);
        res.json(report.rows);
    } catch (err) {
        console.log(err.message);
    }
});





// Get all the platos
app.get("/platos", async (req, res) => {
    try {
        const platos = await pool.query("SELECT nombre FROM public.food");
        res.json(platos.rows);
    }
    catch {
        console.log("Error Message");
    }
});



// Get all the platos for a single restaurant
app.get("/platos/:resid", async (req, res) => {
    try {
        const { resid } = req.params
        const platos = await pool.query("SELECT foodname, foodid FROM public.food WHERE restaurantid=$1", [parseInt(resid)]);
        res.json(platos.rows);
    }
    catch (err) {
        console.log(err.message);
    }
});


// Get an specific restaurant
app.get("/res/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const restaurant  = await pool.query(`
        SELECT r.*, string_agg(DISTINCT f.foodcategory, ', ' ORDER BY f.foodcategory) AS categories
        FROM public.restaurants r
        LEFT JOIN public.food f ON r.restaurantid = f.restaurantid
        WHERE r.restaurantid = $1
        GROUP BY r.restaurantid
        `, [id]);
        res.json(restaurant.rows[0]);
        console.log(restaurant.rows[0]);
    }
    catch (err) {
        console.log(err.message);
    }
});

// Get an specific restaurant survey averages

app.get("/resavg/:id", async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query; // Retrieve optional startDate and endDate from the query parameters

    let queryParams = [id];
    let dateFilter = '';

    // Add date filtering to the query if startDate and endDate are provided
    if (startDate && endDate) {
        dateFilter = 'AND created_at::date BETWEEN $2 AND $3';
        queryParams.push(startDate, endDate); // Add startDate and endDate to the query parameters
    }

    try {
        const query = `
            SELECT 
                ROUND(AVG(ratingfood),1) AS AverageRatingFood, 
                ROUND(AVG(ratingservice),1) AS AverageRatingService, 
                ROUND(AVG(ratingenvironment),1) AS AverageRatingEnvironment, 
                ROUND((AVG(ratingfood) + AVG(ratingservice) + AVG(ratingenvironment)) / 3, 1) AS OverallAverage, 
                COUNT(surveyid) AS TotalSurveys 
            FROM 
                public.surveys 
            WHERE 
                restaurantid = $1
                ${dateFilter}
        `;
        const restaurant = await pool.query(query, queryParams);
        res.json(restaurant.rows[0]);
    } catch (err) {
        console.log(err.message);
        res.status(500).send("Server error");
    }
});

// Get an specific restaurant survey averages
app.get("/ressurvey/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const results = await pool.query(`
            SELECT 
                s.surveyid, 
                s.userid, 
                s.restaurantid, 
                s.ratingfood, 
                s.ratingservice, 
                s.ratingenvironment, 
                s.foodcomment, 
                s.servicecomment, 
                s.environmentcomment, 
                s.created_at,
                u.username
            FROM 
                public.surveys AS s
            LEFT JOIN 
                public.users AS u ON s.userid = u.userid
            WHERE 
                s.restaurantid = $1 AND
                s.ratingfood IS NOT NULL AND
                s.ratingservice IS NOT NULL AND
                s.ratingenvironment IS NOT NULL
            ORDER BY 
                s.created_at DESC
        `, [id]);
        res.json(results.rows);
    } catch (err) {
        console.error(err.message);
    }
});



app.get("/resfood/:id", async (req, res) => {

    try {
        const { id } = req.params;
        const restaurant = await pool.query(`SELECT food.foodid, food.restaurantid, food.foodname, food.foodtype, food.foodcategory, food.price, food.description, food.image, 
        ROUND(AVG(foodratings.foodrating),0) AS foodratings, ROUND(COUNT(foodratings.foodrating),0) AS foodsurveys
    FROM 
        public.food
    LEFT JOIN 
        public.foodratings ON food.foodid = foodratings.foodid
        WHERE food.restaurantid=$1
    GROUP BY food.foodid, food.restaurantid, food.foodname, food.foodtype, food.foodcategory, food.price, food.description, food.image;`, [id]);
        res.json(restaurant.rows);
    }
    catch (err) {
        console.log(err.message);
    }
});


app.post("/updateresfood/:foodid", async (req, res) => {
    try {
        const { foodid } = req.params;
        const { foodName, foodType, foodCategory, foodDesc, foodPrice } = req.body;
        const updateQuery = `UPDATE food SET foodname = $1, foodtype = $2, foodcategory = $3, description = $4, price = $5 WHERE foodid = $6`;
        const response = await pool.query(updateQuery, [foodName, foodType, foodCategory, foodDesc, foodPrice, foodid]);
        res.json({ message: "Food item updated successfully" });
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ error: "Internal server error" });
    }
});




app.get("/resfoodreport/:id", async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.query; // Get startDate and endDate from query parameters

    try {
        const restaurant = await pool.query(`
            SELECT 
                food.foodid, 
                food.restaurantid, 
                food.foodname, 
                food.foodtype, 
                food.foodcategory, 
                food.price, 
                food.description, 
                food.image, 
                ROUND(AVG(foodratings.foodrating),1) AS foodratings, 
                COUNT(foodratings.foodrating) AS foodsurveys
            FROM 
                public.food
            LEFT JOIN 
                public.foodratings ON food.foodid = foodratings.foodid
            LEFT JOIN 
                public.surveys ON foodratings.surveyid = surveys.surveyid
            WHERE 
                food.restaurantid = $1
                AND surveys.created_at BETWEEN $2 AND $3
            GROUP BY 
                food.foodid
        `, [id, startDate, endDate]); // Pass startDate and endDate to the query
        res.json(restaurant.rows);
    } catch (err) {
        console.log(err.message);
    }
});




//This is new and has to be add it to the server
app.get("/foodratings/:foodid", async (req, res) => {
    try {
        const { foodid } = req.params;
        const foodRatings = await pool.query(`
        SELECT 
        fr.foodratingid, 
        fr.surveyid, 
        fr.foodid, 
        fr.foodrating, 
        fr.foodcomment,
        u.username
    FROM 
        public.foodratings AS fr
    LEFT JOIN 
        public.surveys AS s ON fr.surveyid = s.surveyid
    LEFT JOIN 
        public.users AS u ON s.userid = u.userid
            WHERE foodid=$1;
        `, [foodid]);
        res.json(foodRatings.rows);
    }
    catch (err) {
        console.error('Error fetching food ratings:', err.message);
        res.status(500).send('Server error');
    }
});



app.get('/logout', (req, res) => {
    // Destroy the user's session
    req.session.destroy(err => {
        if (err) {
            res.status(500).send('Could not log out, please try again');
        } else {
            res.clearCookie('connect.sid', { path: '/' }); // 'connect.sid' is the default session cookie name, change if different
            res.send('Logout successful');
        }
    });
});



//Update an specific restaurant
app.put("/res/:nombre", async (req, res) => {
    try {
        const { nombre } = req.params;
        const { ciudad } = req.body;
        const updateRes = await pool.query("UPDATE public.restaurants set city = $1 WHERE restaurantname = $2", [ciudad, nombre]);
        res.json("Restaurant updated")
    }
    catch (err) {
        console.log(err.message);
    }

});


//delete a restraurant
app.delete("/res/:nombre", async (req, res) => {
    try {
        const { nombre } = req.params;
        const deleteRes = await pool.query("DELETE FROM public.restaurants WHERE restaurantname = $1", [nombre]);
        res.json("Restaurant deleted");

    }
    catch {
        console.log("error message")
    }
})

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
