const express = require('express');
const pgp = require('pg-promise')();
const router = express.Router();


router.use(express.json());


const db = pgp({
    database: 'Weather App'
}) //change connection to something you are using. In this case

// db.many('SELECT * from states').then(() => console.log('works!')); //to test it

router.get('/states', async (req, res) => {
    return res.json(await db.many('SELECT * from states'));
});

//city_id,full state name, and full city name. since both are listed as name in the database you have to specify them as otherwise it will only return 1
router.get('/cities', async (req, res) => {
    return res.json(await db.many(`SELECT cities.id, cities.name as city, states.name as state
    FROM cities 
    INNER JOIN states ON states.abbrev = cities.state_abbrev`))
});




router.get('/states/:abbrev', async (req, res) => {
    const state = await db.oneOrNone('SELECT * from states WHERE abbrev = $(abbrev)', {
        abbrev: req.params.abbrev //values we want to insert
    });

    if (!state) {
        return res.status(404).send('State was not found')
    }
    return res.status(200).json(state);
});

//POST new state
router.post('/states', async (req, res) => {


    try {
        await db.none(`INSERT INTO states (abbrev, name) VALUES ($(abbrev), $(name))`, {
            abbrev: req.body.abbrev,
            name: req.body.name
        })

        const state = await db.one('SELECT abbrev, name FROM states WHERE abbrev = $(abbrev)', { abbrev: req.body.abbrev });

        return res.status(201).json(state);
    }


    catch (error) {
        console.log(error);
        if (error.constraint === 'states_pkey') {
            return res.status(400).send('The state already exists')
        }
    }
});


//Post nw city

router.post('/cities', async (req, res) => {

    try {
        const insert = await db.oneOrNone(`INSERT INTO cities (state_abbrev, name, climate) VALUES ($(state_abbrev), $(name), $(climate)) RETURNING id`, {
            state_abbrev: req.body.state_abbrev,
            name: req.body.name,
            climate: req.body.climate
        })

        const city = await db.one('SELECT state_abbrev, name, climate FROM cities WHERE id = $(id)', { id: insert.id });
        return res.status(201).json(city);
    }


    catch (error) {
        console.log(error);
        if (error.constraint === 'cities_name') {
            return res.status(400).send('The city already exists')
        }
    }

});


//post new temp
router.post('/temperatures', async (req, res) => {

    try {
        await db.none(`INSERT INTO temperatures (city_id, temperature, date) VALUES($(city_id),$(temperature), $(date))`, {
            city_id: req.body.city_id,
            temperature: req.body.temperature,
            date: req.body.date
        })

        const temperature = await db.many('SELECT city_id, temperature,date FROM temperatures WHERE city_id = $(city_id)', { city_id: req.body.city_id })

        return res.status(201).json(temperature);
    }
    catch (error) {
        console.log(error);
        if (error.constraint === 'city_date') {
            return res.status(400).send('The temperature already exists for that day in this city.')
        }
    }

});



//get /cities/:id - return city with average temp
router.get('/cities/:id', async (req, res) => {
    // const city = await db.oneOrNone('SELECT * from cities WHERE id = $(id)', {
    //     id: req.params.id //values we want to insert
    // });

    // if (!city) {
    //     res.status(404).send('City was not found')
    // }

    const averageTemperature = await db.one(`SELECT cities.name, AVG(temperature) 
    FROM temperatures 
    INNER JOIN cities 
    ON cities.id = temperatures.city_id
     WHERE city_id = $(city_id) 
     GROUP BY cities.name`, {
        city_id: req.params.id //values we want to insert
    })


    if (!averageTemperature) {
        return res.status(404).send('Temperatures were not found')
    }

    return res.status(200).json(averageTemperature);
});


// get /temperature/:climate - return avg temperature for that climate
router.get('/temperatures/:climate', async (req, res) => {

    const averageTemperature = await db.one(`SELECT cities.climate, AVG(temperature)
    FROM temperatures
    INNER JOIN cities
    ON cities.id = temperatures.city_id
    WHERE climate = $(climate)
    GROUP BY cities.climate`, {
        climate: req.params.climate
    })

    if (!averageTemperature) {
        return res.status(404).send('Could not find climate')
    }

    return res.status(200).json(averageTemperature);
});

//city and temperature for 2 puts

router.put('/temperatures/:id', async (req, res) => {


    const id = await db.oneOrNone(`SELECT * FROM temperatures WHERE temperatures.id = $(id)`, {
        id: +req.params.id
    })

    if (!id) {
        return res.status(404).send('ID not found')
    }

    const temperature = await db.oneOrNone(`UPDATE temperatures SET temperature = $(temperature) WHERE id = $(id) RETURNING id,temperature`, {
        id: +req.params.id,
        temperature: req.body.temperature
    })

    return res.status(200).json(temperature)


});


router.put('/cities/:id', async (req, res) => {

    const id = await db.oneOrNone(`SELECT * FROM cities WHERE cities.id = $(id)`, {
        id: +req.params.id
    })

    if (!id) {
        return res.status(404).send('City not found')
    }

    const city = await db.oneOrNone(`UPDATE cities SET name = $(name), climate = $(climate) WHERE id = $(id) RETURNING id, state_abbrev, name, climate`, {
        id: +req.params.id,
        name: req.body.name,
        climate: req.body.climate
    })

    return res.status(200).json(city)


});


router.put('/states/:abbrev', async (req, res) => {

    const id = await db.oneOrNone(`SELECT * FROM states WHERE states.abbrev = $(search)`, {
        search: req.params.abbrev
    })

    if (!id) {
        return res.status(404).send('State not found')
    }

    const state = await db.oneOrNone(`UPDATE states SET abbrev = $(abbrev), name= $(name) WHERE abbrev = $(search) RETURNING abbrev,name`, {
        search: req.params.abbrev,
        abbrev: req.body.abbrev,
        name: req.body.name
    })


    return res.status(200).json(state)


});



//DEletes from city, state, and temp

//need to change all the delete restricts to delete cascade
router.delete('/cities/:id', async (req, res) => {

    const city = await db.oneOrNone(`SELECT * FROM cities WHERE cities.id = $(id)`, {
        id: +req.params.id
    })

    if (!city) {
        return res.status(404).send('City not found')
    };

    const deleteCity = await db.none(`DELETE FROM cities WHERE cities.id = $(id)`, {
        id: +req.params.id
    })


    return res.status(204).json(deleteCity);
});



router.delete('/states/:abbrev', async (req, res) => {

    const state = await db.oneOrNone(`SELECT * FROM states WHERE abbrev = $(abbrev)`, {
        abbrev: req.params.abbrev
    })

    if (!state) {
        return res.status(404).send('State not found')
    };

    const deleteState = await db.none(`DELETE FROM states WHERE abbrev = $(abbrev)`, {
        abbrev: req.params.abbrev
    })


    return res.status(204).json(deleteState);
});



router.delete('/temperatures/:id', async (req, res) => {

    const temperatures = await db.oneOrNone(`SELECT * FROM temperatures WHERE temperatures.id = $(id)`, {
        id: +req.params.id
    })

    if (!temperatures) {
        return res.status(404).send('Temperature not found')
    };

    const deleteTemperature = await db.none(`DELETE FROM temperatures WHERE temperatures.id = $(id)`, {
        id: +req.params.id
    })


    return res.status(204).json(deleteTemperature);
});

module.exports = router;