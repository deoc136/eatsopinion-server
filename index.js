const express = require('express');
const app = express();
const user = require('./routes/user')
const cors = require('cors');
const pool = require("./db");
const multer = require('multer')
const path = require('path');
const session = require('express-session');
const fs = require('fs'); 
require('dotenv').config();



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
    const { id } = req.body;
    const newRes = await pool.query("INSERT INTO public.surveys (restaurantid, ratingfood, ratingservice, ratingenvironment, foodComment, serviceComment, environmentComment) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [id, foodRating, serviceRating, environmentRating, foodComment, serviceComment, environmentComment]);
    const insertedId = newRes.rows[0].surveyid;
    res.json(newRes.rows[0]);
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




app.use(session({
    secret: process.env.SESSION_SECRET, // replace with your secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // set to true if using https
  }));


app.use('/login', require('./routes/auth'));


app.get('/getUser', (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
        console.log(req.session.user)
    } else {
        res.sendStatus(401); // Unauthorized
    }
});




// Get all the restaurants
app.get("/res", async (req, res) => {
    try {
        const restaurants = await pool.query("SELECT * FROM public.restaurants");
        res.json(restaurants.rows);
    }
    catch {
        console.log("Error Message");
    }
});


// Get the data for the specific restaurant 
app.get("/reporte/:resid", async (req, res) => {
    const startDate = '2023-12-10'; //req.query.startDate;
    const endDate = '2030-01-01';//req.query.endDate;
    const { resid } = req.params
    try {
        const report = await pool.query(`
        SELECT created_at, AVG(ratingfood) AS avg_comida, AVG(ratingservice) AS avg_servicio, AVG(ratingenvironment) AS avg_entorno,
        COUNT(surveyid) AS cant_encuestas
        FROM public.surveys
        WHERE created_at >= $1 AND created_at <= $2 AND restaurantid = $3
        GROUP BY created_at
        ORDER BY created_at;
      `, [startDate, endDate, parseInt(resid)]);
        res.json(report.rows);
    }
    catch (err) {
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
        const restaurant = await pool.query("SELECT * FROM public.restaurants WHERE restaurantid = $1", [id]);
        res.json(restaurant.rows[0]);
    }
    catch {
        console.log("error message")
    }
});

// Get an specific restaurant survey averages

app.get("/resavg/:id", async (req, res) => {

    try {
        const { id } = req.params;
        const restaurant = await pool.query("SELECT ROUND(AVG(ratingfood),1) AS AverageRatingFood, ROUND(AVG(ratingservice),1) AS AverageRatingService,  ROUND(AVG(ratingenvironment),1) AS AverageRatingEnvironment, ROUND((AVG(ratingfood) + AVG(ratingservice) + AVG(ratingenvironment)) / 3, 1) AS OverallAverage, COUNT(surveyid) AS TotalSurveys FROM public.surveys WHERE restaurantid = $1", [id]);
        res.json(restaurant.rows[0]);
    }
    catch (err) {
        console.log(err.message);
    }
});

// Get an specific restaurant survey averages
app.get("/ressurvey/:id", async (req, res) => {

    try {
        const { id } = req.params;
        const restaurant = await pool.query("SELECT surveyid, userid, restaurantid, ratingfood, ratingservice, ratingenvironment, foodcomment, servicecomment, environmentcomment, created_at FROM public.surveys WHERE restaurantid=$1 ORDER BY created_at desc", [id]);
        res.json(restaurant.rows);
    }
    catch (err) {
        console.log(err.message);
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


app.get('/logout', (req, res) => {
    // Destroy the user's session
    req.session.destroy(err => {
        if (err) {
            res.status(500).send('Could not log out, please try again');
        } else {
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

app.listen(5000, () => {
    console.log('Server is running on http://localhost:5000');
});
