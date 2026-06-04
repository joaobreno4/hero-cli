const neo4j = require('neo4j-driver');

// Singleton: reutilizado por todas as chamadas em api.js
const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://neo4j:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password123'
    ),
    { disableLosslessIntegers: true }
);

module.exports = driver;
