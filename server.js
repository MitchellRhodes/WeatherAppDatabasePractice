const express = require('express');

const app = express();

const port = 3007;

const routes = require('./routes')

app.use('/', routes)


app.listen(port, () =>
    console.log(`server is running on ${port}`)
);