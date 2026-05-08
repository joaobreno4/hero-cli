require('dotenv').config();

module.exports = {
    MARVEL_PUBLIC_KEY: process.env.MARVEL_PUBLIC_KEY,
    MARVEL_PRIVATE_KEY: process.env.MARVEL_PRIVATE_KEY,
    MARVEL_BASE_URL: 'https://gateway.marvel.com/v1/public'
};
