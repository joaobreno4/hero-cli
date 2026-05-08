const axios = require('axios');
const { SUPERHERO_TOKEN } = require('../config/env');

/**
 * Busca personagens na SuperHero API por nome.
 * A SuperHero API é ideal por ser agnóstica (Marvel, DC, etc) 
 * e usar apenas um Token simples.
 */
const getCharacterByName = async (name) => {
    try {
        // A URL utiliza o token que está no seu arquivo .env
        const url = `https://superheroapi.com/api/${SUPERHERO_TOKEN}/search/${name}`;
        
        const response = await axios.get(url);

        // A API retorna "error" se não encontrar nada ou o token for inválido
        if (response.data.response === 'error') {
            console.log(`[SRE INFO] Nenhum herói encontrado para: ${name}`);
            return [];
        }

        // Mapeamos os resultados para o formato padrão do nosso ecossistema
        return response.data.results.map(hero => ({
            id: hero.id,
            name: hero.name,
            // Agrupamos informações biográficas na descrição para o Dashboard
            description: `Editora: ${hero.biography.publisher || 'Desconhecida'} | Identidade: ${hero.biography['full-name'] || 'Secreta'}`,
            thumbnail: hero.image.url,
            // Mantemos os powerstats para futuras implementações de métricas
            powerstats: {
                intelligence: hero.powerstats.intelligence,
                strength: hero.powerstats.strength,
                speed: hero.powerstats.speed
            },
            biography: {
                publisher: hero.biography.publisher
            }
        }));

    } catch (error) {
        // Aqui o dd-trace captura o erro se o Datadog estiver ativo
        console.error('[SRE API CRITICAL ERROR]:', error.message);
        return [];
    }
};

module.exports = { getCharacterByName };
