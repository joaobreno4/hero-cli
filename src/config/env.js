require('dotenv').config();

module.exports = {
    token: process.env.SUPERHERO_TOKEN,
    baseUrl: `https://superheroapi.com/api/${process.env.SUPERHERO_TOKEN}`
};
