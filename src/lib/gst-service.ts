/**
 * Service to handle HSN code to GST rate mapping.
 * Includes hardcoded mappings for common items and local caching.
 */

import { getSettings } from './storage';

const HSN_CACHE_KEY = 'hsn_gst_cache';
const HSN_DATA_CACHE_KEY = 'hsn_description_cache';

// Enriched HSN mapping with rates and names - Comprehensive coverage
const COMMON_HSN_MAP: Record<string, { rate: number; name: string }> = {
    // Chapter 1-5: Food & Agricultural
    '1001': { rate: 5, name: 'Wheat' },
    '1006': { rate: 5, name: 'Rice' },
    '0401': { rate: 0, name: 'Milk' },
    '0402': { rate: 5, name: 'Milk powder' },
    '0403': { rate: 0, name: 'Buttermilk' },
    '0405': { rate: 12, name: 'Butter' },
    '0406': { rate: 12, name: 'Cheese' },
    '0407': { rate: 0, name: 'Eggs' },
    '0502': { rate: 12, name: 'Fish' },
    '0504': { rate: 12, name: 'Meat' },
    '0601': { rate: 0, name: 'Live Animals - cattle' },
    '0702': { rate: 0, name: 'Vegetables' },
    '0703': { rate: 0, name: 'Onions' },
    '0704': { rate: 0, name: 'Cabbages' },
    '0705': { rate: 0, name: 'Lettuce' },
    '0706': { rate: 0, name: 'Carrots' },
    '0707': { rate: 0, name: 'Cucumbers' },
    '0708': { rate: 0, name: 'Legumes' },
    '0709': { rate: 0, name: 'Other vegetables' },
    '0801': { rate: 0, name: 'Coconuts' },
    '0802': { rate: 0, name: 'Other nuts' },
    '0804': { rate: 0, name: 'Dates' },
    '0805': { rate: 0, name: 'Citrus fruits' },
    '0806': { rate: 0, name: 'Grapes' },
    '0807': { rate: 0, name: 'Melons' },
    '0808': { rate: 0, name: 'Apples & Pears' },
    '0809': { rate: 0, name: 'Apricots & Fruits' },
    '0810': { rate: 0, name: 'Fresh Fruits' },
    '0901': { rate: 5, name: 'Coffee' },
    '0902': { rate: 5, name: 'Tea' },
    '0903': { rate: 5, name: 'Spices' },
    '1005': { rate: 5, name: 'Rice' },
    '1701': { rate: 5, name: 'Sugar' },
    '1702': { rate: 0, name: 'Sugar beet' },
    '1704': { rate: 5, name: 'Sugar products' },
    '1901': { rate: 12, name: 'Cereal preparations' },
    '1902': { rate: 12, name: 'Pasta' },
    '1905': { rate: 12, name: 'Biscuits' },
    '2008': { rate: 12, name: 'Prepared vegetables' },
    '2009': { rate: 12, name: 'Juices' },
    '2101': { rate: 12, name: 'Coffee extracts' },
    '2104': { rate: 12, name: 'Soups and broths' },
    '2106': { rate: 12, name: 'Snacks & prepared foods' },
    
    // Chapter 2: Beverages & Alcohol
    '2202': { rate: 28, name: 'Aerated drinks' },
    '2203': { rate: 5, name: 'Beer' },
    '2204': { rate: 5, name: 'Wine' },
    '2207': { rate: 5, name: 'Alcohol' },
    '2208': { rate: 5, name: 'Spirits' },
    
    // Chapter 3: Personal Care & Cosmetics
    '3301': { rate: 18, name: 'Essential Oils' },
    '3304': { rate: 18, name: 'Cosmetics & Make-up' },
    '3305': { rate: 18, name: 'Shampoo' },
    '3306': { rate: 18, name: 'Toothpaste' },
    '3307': { rate: 18, name: 'Pre shaving products' },
    
    // Chapter 3: Soaps & Detergents
    '3401': { rate: 18, name: 'Soap' },
    '3402': { rate: 18, name: 'Detergents & Cleaners' },
    '3403': { rate: 18, name: 'Surface Active Agents' },
    '3406': { rate: 18, name: 'Candles' },
    
    // Chapter 4: Paper & Pulp
    '4818': { rate: 18, name: 'Tissues & Napkins' },
    '4901': { rate: 12, name: 'Books' },
    '4902': { rate: 12, name: 'Newspapers' },
    '4911': { rate: 12, name: 'Printed matter' },
    
    // Chapter 5: Textiles
    '5007': { rate: 5, name: 'Woven fabrics' },
    '5208': { rate: 5, name: 'Cotton fabrics' },
    '5209': { rate: 5, name: 'Cotton denim' },
    '6109': { rate: 12, name: 'T-shirts' },
    '6110': { rate: 5, name: 'Knitted garments' },
    '6203': { rate: 5, name: 'Mens trousers' },
    '6204': { rate: 5, name: 'Womens trousers' },
    '6205': { rate: 5, name: 'Mens shirts' },
    '6206': { rate: 5, name: 'Womens blouses' },
    '6209': { rate: 5, name: 'Babies garments' },
    '6210': { rate: 5, name: 'Garment parts' },
    
    // Chapter 6: Footwear
    '6401': { rate: 12, name: 'Rubber footwear' },
    '6402': { rate: 12, name: 'Canvas footwear' },
    '6403': { rate: 12, name: 'Leather footwear' },
    '6404': { rate: 12, name: 'Sports footwear' },
    '6405': { rate: 12, name: 'Other footwear' },
    
    // Chapter 7: Ceramics & Glass
    '6907': { rate: 12, name: 'Tiles' },
    '7007': { rate: 12, name: 'Safety glass' },
    '7010': { rate: 12, name: 'Carboys & jars' },
    '7013': { rate: 12, name: 'Glassware' },
    
    // Chapter 8: Metals & Metal products
    '7210': { rate: 12, name: 'Iron sheets' },
    '7212': { rate: 12, name: 'Steel plates' },
    '7216': { rate: 12, name: 'Iron angles' },
    '7217': { rate: 12, name: 'Steel wire' },
    '7218': { rate: 12, name: 'Steel alloys' },
    '7219': { rate: 12, name: 'Stainless steel coils' },
    '7220': { rate: 12, name: 'Stainless steel sheets' },
    '7225': { rate: 12, name: 'Flat rolled steel' },
    '7226': { rate: 12, name: 'Molybdenum steel' },
    '7307': { rate: 12, name: 'Pipe fittings' },
    '7308': { rate: 12, name: 'Structural steel' },
    '7309': { rate: 12, name: 'Reservoirs & tanks' },
    '7310': { rate: 12, name: 'Barrels & drums' },
    '7311': { rate: 12, name: 'Containers of metal' },
    '7312': { rate: 12, name: 'Steel strapping' },
    '7313': { rate: 12, name: 'Barbed wire' },
    '7314': { rate: 12, name: 'Wire mesh' },
    '7315': { rate: 12, name: 'Chain' },
    '7318': { rate: 12, name: 'Fasteners' },
    '7319': { rate: 12, name: 'Nails & similar' },
    '7320': { rate: 12, name: 'Springs' },
    '7321': { rate: 12, name: 'Stoves' },
    '7323': { rate: 12, name: 'Tableware of iron' },
    '7324': { rate: 12, name: 'Kitchenware of iron' },
    '7325': { rate: 12, name: 'Other cast iron items' },
    '7326': { rate: 12, name: 'Iron articles' },
    '7408': { rate: 12, name: 'Copper wire' },
    '7409': { rate: 12, name: 'Copper plates' },
    '7410': { rate: 12, name: 'Copper foil' },
    '7411': { rate: 12, name: 'Copper tubes & pipes' },
    '7412': { rate: 12, name: 'Copper fittings' },
    '7418': { rate: 12, name: 'Copper articles' },
    '7607': { rate: 12, name: 'Aluminium foil' },
    '7608': { rate: 12, name: 'Aluminium tubes' },
    '7610': { rate: 12, name: 'Aluminium structures' },
    '7613': { rate: 12, name: 'Aluminium containers' },
    '7615': { rate: 12, name: 'Aluminium articles' },
    
    // Chapter 9: Electrical & Machinery
    '8407': { rate: 18, name: 'Internal combustion engine' },
    '8408': { rate: 18, name: 'Diesel engines' },
    '8409': { rate: 18, name: 'Engine parts' },
    '8412': { rate: 18, name: 'Hydraulic pumps' },
    '8413': { rate: 18, name: 'Pumps' },
    '8414': { rate: 18, name: 'Air compressors' },
    '8415': { rate: 18, name: 'AC units' },
    '8421': { rate: 18, name: 'Centrifuges' },
    '8422': { rate: 18, name: 'Machinery for food' },
    '8423': { rate: 18, name: 'Weighing machinery' },
    '8424': { rate: 18, name: 'Spraying machinery' },
    '8425': { rate: 18, name: 'Pulleys & hoists' },
    '8426': { rate: 18, name: 'Cranes' },
    '8427': { rate: 18, name: 'Material lifting' },
    '8428': { rate: 18, name: 'Conveyor systems' },
    '8429': { rate: 18, name: 'Bulldozers & scrapers' },
    '8430': { rate: 18, name: 'Earth moving machinery' },
    '8431': { rate: 18, name: 'Parts for machinery' },
    '8444': { rate: 18, name: 'Extruders for plastics' },
    '8445': { rate: 18, name: 'Machinery for textiles' },
    '8451': { rate: 18, name: 'Machinery for laundry' },
    '8452': { rate: 18, name: 'Sewing machines' },
    '8454': { rate: 12, name: 'Shoe machinery' },
    '8455': { rate: 18, name: 'Rolling mill machinery' },
    '8456': { rate: 18, name: 'Machine tools' },
    '8457': { rate: 18, name: 'Numerically controlled machines' },
    '8458': { rate: 18, name: 'Lathes' },
    '8459': { rate: 18, name: 'Boring machines' },
    '8460': { rate: 18, name: 'Grinding machines' },
    '8461': { rate: 18, name: 'Saws' },
    '8462': { rate: 18, name: 'Press machines' },
    '8465': { rate: 18, name: 'Woodworking machinery' },
    '8471': { rate: 18, name: 'Automatic data processing machines' },
    '8472': { rate: 18, name: 'Other office machines' },
    '8473': { rate: 18, name: 'Parts of office machines' },
    '8479': { rate: 18, name: 'Other special purpose machinery' },
    '8481': { rate: 18, name: 'Taps, valves & similar' },
    '8482': { rate: 18, name: 'Ball bearings' },
    '8484': { rate: 18, name: 'Gears & machinery parts' },
    '8485': { rate: 18, name: 'Other machinery parts' },
    
    // Chapter 10: Electrical Equipment
    '8501': { rate: 18, name: 'Electric motors' },
    '8502': { rate: 18, name: 'Electric generators' },
    '8503': { rate: 18, name: 'Parts of motors & generators' },
    '8504': { rate: 18, name: 'Transformers' },
    '8505': { rate: 18, name: 'Electromagnets' },
    '8506': { rate: 18, name: 'Primary cells' },
    '8507': { rate: 18, name: 'Electric accumulators' },
    '8508': { rate: 18, name: 'Vacuum cleaners' },
    '8509': { rate: 18, name: 'Electromechanical appliances' },
    '8510': { rate: 18, name: 'Shavers & clippers' },
    '8511': { rate: 18, name: 'Electrical ignition systems' },
    '8512': { rate: 18, name: 'Electrical lighting systems' },
    '8513': { rate: 18, name: 'Portable electric lamps' },
    '8514': { rate: 18, name: 'Industrial furnaces' },
    '8515': { rate: 18, name: 'Electric welding machines' },
    '8516': { rate: 18, name: 'Electric water heaters' },
    '8517': { rate: 18, name: 'Electrical apparatus for switching' },
    '8518': { rate: 18, name: 'Microphones & speakers' },
    '8519': { rate: 18, name: 'Sound recording machines' },
    '8520': { rate: 18, name: 'Magnetic tape recorders' },
    '8521': { rate: 18, name: 'Video cameras' },
    '8522': { rate: 18, name: 'Parts and accessories of video' },
    '8523': { rate: 18, name: 'Magnetic, optical media' },
    '8524': { rate: 18, name: 'Records, tapes, discs' },
    '8525': { rate: 18, name: 'Transmission apparatus' },
    '8526': { rate: 18, name: 'Radar apparatus' },
    '8527': { rate: 18, name: 'Radio receivers' },
    '8528': { rate: 18, name: 'Television receivers' },
    '8529': { rate: 18, name: 'Parts for radio/TV' },
    '8530': { rate: 18, name: 'Signalling apparatus' },
    '8531': { rate: 18, name: 'Electric sound signalling' },
    '8532': { rate: 18, name: 'Electrical capacitors' },
    '8533': { rate: 18, name: 'Electrical resistors' },
    '8534': { rate: 18, name: 'Electrical printed circuits' },
    '8535': { rate: 18, name: 'Electrical fuses & switches' },
    '8536': { rate: 18, name: 'Electrical connectors' },
    '8537': { rate: 18, name: 'Boards for control' },
    '8538': { rate: 18, name: 'Electrical parts' },
    '8539': { rate: 18, name: 'Lamps and light sources' },
    '8540': { rate: 18, name: 'Thermionic valves' },
    '8541': { rate: 18, name: 'Semiconductor devices' },
    '8542': { rate: 18, name: 'Electronic integrated circuits' },
    '8543': { rate: 18, name: 'Electrical machines' },
    '8544': { rate: 18, name: 'Insulated wires & cables' },
    '8545': { rate: 18, name: 'Carbon articles' },
    '8546': { rate: 18, name: 'Electrical insulators' },
    '8547': { rate: 18, name: 'Insulating fittings' },
    '8548': { rate: 18, name: 'Waste & scrap of electrical' },
    
    // Chapter 11: Transport Equipment
    '8704': { rate: 12, name: 'Motor vehicles for transport' },
    '8705': { rate: 12, name: 'Special purpose vehicles' },
    '8706': { rate: 12, name: 'Chassis for motor vehicles' },
    '8707': { rate: 12, name: 'Bodies for motor vehicles' },
    '8708': { rate: 12, name: 'Motor vehicle parts' },
    '8711': { rate: 12, name: 'Motorcycles' },
    
    // Chapter 12: Optical & Photographic
    '9001': { rate: 12, name: 'Optical fibres & cables' },
    '9002': { rate: 12, name: 'Lenses & optical elements' },
    '9003': { rate: 12, name: 'Frames for spectacles' },
    '9004': { rate: 12, name: 'Spectacles' },
    '9005': { rate: 12, name: 'Binoculars & telescopes' },
    '9006': { rate: 12, name: 'Cameras & equipment' },
    '9007': { rate: 12, name: 'Cinematograph cameras' },
    '9008': { rate: 12, name: 'Projectors & enlargers' },
    '9009': { rate: 12, name: 'Photographic plates' },
    '9010': { rate: 12, name: 'Exposure meters' },
    '9011': { rate: 12, name: 'Compound optical microscopes' },
    '9012': { rate: 12, name: 'Microscopes parts' },
    '9013': { rate: 12, name: 'Liquid crystal devices' },
    '9014': { rate: 12, name: 'Surveying instruments' },
    '9015': { rate: 12, name: 'Navigational instruments' },
    '9016': { rate: 12, name: 'Balances of high accuracy' },
    '9017': { rate: 12, name: 'Drawing instruments' },
    '9018': { rate: 12, name: 'Medical instruments' },
    '9019': { rate: 12, name: 'Orthopaedic appliances' },
    '9020': { rate: 12, name: 'Breathing appliances' },
    '9021': { rate: 12, name: 'Surgical implants' },
    '9022': { rate: 12, name: 'Instruments for physical therapy' },
    '9023': { rate: 12, name: 'Instruments for mechanics' },
    '9024': { rate: 12, name: 'Instruments for electricity' },
    '9025': { rate: 12, name: 'Hydrometers & instruments' },
    '9026': { rate: 12, name: 'Instruments for measuring' },
    '9027': { rate: 12, name: 'Instruments for analysis' },
    '9028': { rate: 18, name: 'Meters for gases & liquids' },
    '9029': { rate: 12, name: 'Revolution counters & meters' },
    '9030': { rate: 12, name: 'Oscilloscopes & instruments' },
    '9031': { rate: 12, name: 'Instruments for measuring' },
    
    // Chapter 13: Clocks & Precision Instruments
    '9101': { rate: 12, name: 'Wrist watches' },
    '9102': { rate: 12, name: 'Pocket watches' },
    '9103': { rate: 12, name: 'Wall clocks' },
    '9104': { rate: 12, name: 'Instrument panel clocks' },
    '9105': { rate: 12, name: 'Other clocks' },
    '9106': { rate: 12, name: 'Clock parts' },
    
    // Chapter 14: Miscellaneous
    '9503': { rate: 12, name: 'Toys & games' },
    '9504': { rate: 12, name: 'Articles for sport' },
    '9505': { rate: 12, name: 'Festive articles' },
    '9506': { rate: 12, name: 'Articles for gymnastics' },
    '9507': { rate: 12, name: 'Fishing articles' },
    '9508': { rate: 12, name: 'Circus & fairground articles' },
    '9509': { rate: 12, name: 'Articles for amusement' },
    '9510': { rate: 12, name: 'Articles for amusement rides' },
    
    // Chapter 15: Arms & Ammunition
    '9303': { rate: 18, name: 'Firearms' },
    '9304': { rate: 18, name: 'Parts of firearms' },
    '9305': { rate: 18, name: 'Other arms' },
    '9306': { rate: 18, name: 'Ammunition & parts' },
    
    // Additional commonly used HSN codes
    '2501': { rate: 0, name: 'Salt' },
    '0701': { rate: 0, name: 'Potatoes' },
    '0102': { rate: 0, name: 'Bovine animals' },
    '0103': { rate: 0, name: 'Swine' },
    '0105': { rate: 0, name: 'Poultry' },
};

interface HsnCache {
    [hsnCode: string]: number;
}

interface HsnDataCache {
    [hsnCode: string]: {
        description: string;
        rate: number;
        name: string;
    };
}

function getCache(): HsnCache {
    try {
        const cached = localStorage.getItem(HSN_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch {
        return {};
    }
}

function setCache(cache: HsnCache) {
    try {
        localStorage.setItem(HSN_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to save HSN cache:', error);
    }
}

function getDataCache(): HsnDataCache {
    try {
        const cached = localStorage.getItem(HSN_DATA_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch {
        return {};
    }
}

function setDataCache(cache: HsnDataCache) {
    try {
        localStorage.setItem(HSN_DATA_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to save HSN data cache:', error);
    }
}

/**
 * Fetches GST rate and description for a given HSN code from multiple sources.
 * Tries: FastGST API -> Open GST API -> Hardcoded map -> Heuristic
 */
export async function fetchHsnData(hsnCode: string): Promise<{ rate: number; description: string; name: string } | null> {
    if (!hsnCode || hsnCode.length < 4) return null;

    // 1. Check data cache first
    const dataCache = getDataCache();
    if (dataCache[hsnCode]) {
        return dataCache[hsnCode];
    }

    // 2. Check common map (Instant lookup for common items)
    if (COMMON_HSN_MAP[hsnCode] !== undefined) {
        const entry = COMMON_HSN_MAP[hsnCode];
        return { rate: entry.rate, description: '', name: entry.name };
    }

    const settings = getSettings();
    const apiKey = settings.fastGstApiKey;

    // Try multiple APIs
    let result = null;

    // 3. Try FastGST API (if configured)
    if (apiKey) {
        result = await tryFastGSTAPI(hsnCode, apiKey);
        if (result) return result;
    }

    // 4. Try Open GST Database API (free tier)
    result = await tryOpenGSTAPI(hsnCode);
    if (result) return result;

    // 5. Try alternative API
    result = await tryAlternativeAPI(hsnCode);
    if (result) return result;

    // 6. Fallback to heuristic
    const rate = simulateExternalLookup(hsnCode);
    if (rate !== null) {
        result = { rate, description: 'Estimated from HSN chapter', name: '' };
        saveGstRate(hsnCode, rate);
        return result;
    }

    return null;
}

/**
 * Try FastGST API
 */
async function tryFastGSTAPI(hsnCode: string, apiKey: string): Promise<{ rate: number; description: string; name: string } | null> {
    try {
        const taxResponse = await fetch(`https://api.fastgst.in/v1/search/hsn/${hsnCode}/taxes`, {
            headers: { 'x-api-key': apiKey }
        });

        if (!taxResponse.ok) return null;

        const taxData = await taxResponse.json();
        let rate = 0;
        
        if (taxData.data) {
            const d = taxData.data;
            rate = d.rate || d.gst_rate || d.tax_rate || d.gst || 
                   (d.igst_rate !== undefined ? d.igst_rate : 0) ||
                   ((d.cgst_rate || 0) + (d.sgst_rate || 0)) || 0;
        } else {
            rate = taxData.rate || taxData.gst || 0;
        }

        const infoResponse = await fetch(`https://api.fastgst.in/v1/search/hsn/${hsnCode}`, {
            headers: { 'x-api-key': apiKey }
        });

        let description = '';
        let name = '';
        if (infoResponse.ok) {
            const infoData = await infoResponse.json();
            description = infoData.data?.description || infoData.description || '';
            const title = infoData.data?.title || infoData.title || infoData.data?.hsn_name || '';
            if (title) {
                name = title;
            } else if (description) {
                name = description.split(',')[0].split(';')[0].split('(')[0].trim();
                if (name.length > 50) name = name.substring(0, 47) + '...';
            }
        }

        const result = { rate, description, name };
        
        // Save to cache
        const dataCache = getDataCache();
        dataCache[hsnCode] = result;
        setDataCache(dataCache);
        
        const cache = getCache();
        cache[hsnCode] = rate;
        setCache(cache);

        return result;
    } catch (error) {
        console.error('FastGST API error:', error);
        return null;
    }
}

/**
 * Try Open GST API (free alternative)
 */
async function tryOpenGSTAPI(hsnCode: string): Promise<{ rate: number; description: string; name: string } | null> {
    try {
        // Using open GST database endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://cgst-rate-api.herokuapp.com/api/v1/hsn/${hsnCode}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        const rate = data.rate || data.gst_rate || 0;
        const name = data.hsn_description || data.description || '';

        const result = { rate, description: '', name };
        
        // Save to cache
        const dataCache = getDataCache();
        dataCache[hsnCode] = result;
        setDataCache(dataCache);
        
        const cache = getCache();
        cache[hsnCode] = rate;
        setCache(cache);

        return result;
    } catch (error) {
        console.error('Open GST API error:', error);
        return null;
    }
}

/**
 * Try alternative HarmonizedCode lookup
 */
async function tryAlternativeAPI(hsnCode: string): Promise<{ rate: number; description: string; name: string } | null> {
    try {
        // Try World Tariff HS database equivalent
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`https://api.gst.taxscan.in/api/hsn/${hsnCode}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;

        const data = await response.json();
        const rate = data.rate || data.gstRate || 0;
        const name = data.description || data.productName || '';

        const result = { rate, description: '', name };
        
        // Save to cache
        const dataCache = getDataCache();
        dataCache[hsnCode] = result;
        setDataCache(dataCache);
        
        const cache = getCache();
        cache[hsnCode] = rate;
        setCache(cache);

        return result;
    } catch (error) {
        console.error('Alternative API error:', error);
        return null;
    }
}

/**
 * Fetches GST rate for a given HSN code.
 * 1. Checks local hardcoded map.
 * 2. Checks localStorage cache.
 * 3. Calls FastGST API.
 * 4. Fallback to heuristic.
 */
export async function getGstRate(hsnCode: string | undefined): Promise<number | null> {
    if (!hsnCode) return null;

    const code = hsnCode.trim();
    if (!code) return null;

    // 1. Check common map
    if (COMMON_HSN_MAP[code] !== undefined) {
        return COMMON_HSN_MAP[code].rate;
    }

    // 2. Check local cache
    const cache = getCache();
    if (cache[code] !== undefined) {
        return cache[code];
    }

    // 3. Try FastGST API
    const apiData = await fetchHsnData(code);
    if (apiData !== null) {
        return apiData.rate;
    }

    // 4. Fallback heuristic
    const rate = simulateExternalLookup(code);
    if (rate !== null) {
        saveGstRate(code, rate);
    }

    return rate;
}

function simulateExternalLookup(hsnCode: string): number | null {
    // Improved heuristic based on HSN chapter classification
    if (!hsnCode || hsnCode.length < 4) return null;
    
    const firstLetter = hsnCode.charAt(0);
    const firstTwoDigits = parseInt(hsnCode.substring(0, 2), 10);
    
    // Chapter 01-09: Animal & Plant Products, Foods
    if (firstTwoDigits <= 9) {
        return 0; // Essential foods & agricultural products
    }
    
    // Chapter 06-14: Textiles and Apparel
    if (firstTwoDigits >= 50 && firstTwoDigits <= 65) {
        return 5; // Most textiles & apparel
    }
    
    // Chapter 15-18: Minerals, Chemicals
    if (firstTwoDigits >= 25 && firstTwoDigits <= 38) {
        return 12; // Most chemicals & minerals
    }
    
    // Chapter 19-20: Plastics, Rubber, Leather
    if (firstTwoDigits >= 39 && firstTwoDigits <= 43) {
        return 18; // Manufactured goods
    }
    
    // Chapter 21-49: Wood, Paper Products
    if (firstTwoDigits >= 44 && firstTwoDigits <= 49) {
        return 18; // Paper & manufactured goods
    }
    
    // Chapter 50-67: Textiles, Footwear, Stone
    if (firstTwoDigits >= 50 && firstTwoDigits <= 72) {
        return 12; // Textiles, Footwear, Ceramics
    }
    
    // Chapter 73-83: Metals & Metal Products
    if (firstTwoDigits >= 72 && firstTwoDigits <= 83) {
        return 12; // Metal products
    }
    
    // Chapter 84-85: Machinery and Electrical Equipment
    if (firstTwoDigits >= 84 && firstTwoDigits <= 85) {
        return 18; // Machinery, Electrical, Electronics
    }
    
    // Chapter 86-89: Transport
    if (firstTwoDigits >= 86 && firstTwoDigits <= 89) {
        return 12; // Transport equipment
    }
    
    // Chapter 90-97: Optical, Precision, Miscellaneous
    if (firstTwoDigits >= 90) {
        return 12; // Optical, Scientific, Miscellaneous
    }
    
    // Default fallback
    return 12;
}

/**
 * Gets product name from HSN code (lookup from common map)
 */
export function getProductNameFromHSN(hsnCode: string | undefined): string | null {
    if (!hsnCode) return null;
    const code = hsnCode.trim();
    if (COMMON_HSN_MAP[code]) {
        return COMMON_HSN_MAP[code].name;
    }
    return null;
}

/**
 * Generates a tax filing report for GST returns
 * Used for GSTR-1 (outward supplies) filings
 */
export interface TaxFilingReportItem {
    hsnCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    sgstRate: number;
    cgstRate: number;
    igstRate: number;
    taxableAmount: number;
    sgstAmount: number;
    cgstAmount: number;
    igstAmount: number;
    totalTaxAmount: number;
    totalAmount: number;
}

export interface TaxFilingReport {
    reportDate: string;
    period: string;
    totalItems: number;
    totalQuantity: number;
    totalTaxableAmount: number;
    totalSGST: number;
    totalCGST: number;
    totalIGST: number;
    totalTax: number;
    totalAmount: number;
    items: TaxFilingReportItem[];
}

/**
 * Generates a comprehensive tax filing report from bills data
 * Suitable for GSTR-1 filing in India
 */
export function generateTaxFilingReport(
    bills: any[],
    products: any[],
    startDate?: Date,
    endDate?: Date
): TaxFilingReport {
    const productMap = new Map<string, any>();
    products.forEach(p => productMap.set(p.id, p));

    const items: TaxFilingReportItem[] = [];
    const itemMap = new Map<string, TaxFilingReportItem>();

    // Filter bills by date range if provided
    let filteredBills = bills;
    if (startDate && endDate) {
        filteredBills = bills.filter(b => {
            const billDate = new Date(b.createdAt);
            return billDate >= startDate && billDate <= endDate;
        });
    }

    // Process each bill
    filteredBills.forEach(bill => {
        bill.items.forEach((item: any) => {
            const product = productMap.get(item.productId);
            const gstPercentage = product?.gstPercentage || item.gstPercentage || 0;
            const hsnCode = product?.hsnCode || '999999'; // Default HSN for no-HSN items

            // Calculate tax breakdown (India GST uses combined SGST + CGST = total GST)
            // IGST is used for inter-state; for intra-state, SGST + CGST = GST
            let sgstRate = 0;
            let cgstRate = 0;
            let igstRate = 0;

            // Assuming intra-state for now; inter-state would use IGST
            if (gstPercentage > 0) {
                sgstRate = gstPercentage / 2;
                cgstRate = gstPercentage / 2;
            }

            // Calculate base amount (excluding tax)
            const baseAmount = item.totalPrice / (1 + gstPercentage / 100);
            const sgstAmount = baseAmount * (sgstRate / 100);
            const cgstAmount = baseAmount * (cgstRate / 100);
            const igstAmount = 0; // For intra-state

            const key = `${hsnCode}-${item.productName}`;
            if (itemMap.has(key)) {
                const existing = itemMap.get(key)!;
                existing.quantity += item.quantity;
                existing.taxableAmount += baseAmount;
                existing.sgstAmount += sgstAmount;
                existing.cgstAmount += cgstAmount;
                existing.totalTaxAmount += sgstAmount + cgstAmount;
                existing.totalAmount += item.totalPrice;
            } else {
                itemMap.set(key, {
                    hsnCode,
                    description: item.productName,
                    quantity: item.quantity,
                    unitPrice: baseAmount / item.quantity,
                    sgstRate,
                    cgstRate,
                    igstRate,
                    taxableAmount: baseAmount,
                    sgstAmount,
                    cgstAmount,
                    igstAmount,
                    totalTaxAmount: sgstAmount + cgstAmount,
                    totalAmount: item.totalPrice,
                });
            }
        });
    });

    // Convert map to array and sort
    itemMap.forEach((item) => items.push(item));
    items.sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate totals
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalTaxableAmount = items.reduce((sum, item) => sum + item.taxableAmount, 0);
    const totalSGST = items.reduce((sum, item) => sum + item.sgstAmount, 0);
    const totalCGST = items.reduce((sum, item) => sum + item.cgstAmount, 0);
    const totalIGST = items.reduce((sum, item) => sum + item.igstAmount, 0);
    const totalTax = totalSGST + totalCGST + totalIGST;
    const totalAmount = items.reduce((sum, item) => sum + item.totalAmount, 0);

    const now = new Date();
    const periodStr = startDate && endDate
        ? `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
        reportDate: now.toISOString().split('T')[0],
        period: periodStr,
        totalItems: items.length,
        totalQuantity,
        totalTaxableAmount,
        totalSGST,
        totalCGST,
        totalIGST,
        totalTax,
        totalAmount,
        items,
    };
}

/**
 * Formats tax report as HTML for printing/viewing
 */
export function formatTaxReportAsHTML(report: TaxFilingReport): string {
    const currencyFormat = (value: number) => `₹${value.toFixed(2)}`;

    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Tax Filing Report - GSTR-1</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
            th { background-color: #4CAF50; color: white; }
            td { background-color: #f9f9f9; }
            .text-left { text-align: left; }
            .summary { background-color: #e8f5e9; font-weight: bold; }
            .total-row { background-color: #c8e6c9; font-weight: bold; }
            .header-info { margin-bottom: 20px; }
        </style>
    </head>
    <body>
        <h1>Tax Filing Report (GSTR-1)</h1>
        <div class="header-info">
            <p><strong>Report Date:</strong> ${report.reportDate}</p>
            <p><strong>Period:</strong> ${report.period}</p>
            <p><strong>Generated for GST Return Filing</strong></p>
        </div>

        <h2>Summary</h2>
        <table>
            <tr>
                <td class="text-left">Total Items</td>
                <td>${report.totalItems}</td>
            </tr>
            <tr>
                <td class="text-left">Total Quantity</td>
                <td>${report.totalQuantity}</td>
            </tr>
            <tr>
                <td class="text-left">Total Taxable Amount</td>
                <td>${currencyFormat(report.totalTaxableAmount)}</td>
            </tr>
            <tr>
                <td class="text-left">Total SGST</td>
                <td>${currencyFormat(report.totalSGST)}</td>
            </tr>
            <tr>
                <td class="text-left">Total CGST</td>
                <td>${currencyFormat(report.totalCGST)}</td>
            </tr>
            <tr>
                <td class="text-left">Total IGST</td>
                <td>${currencyFormat(report.totalIGST)}</td>
            </tr>
            <tr class="total-row">
                <td class="text-left">Total Tax</td>
                <td>${currencyFormat(report.totalTax)}</td>
            </tr>
            <tr class="total-row">
                <td class="text-left">Total Amount (Incl. Tax)</td>
                <td>${currencyFormat(report.totalAmount)}</td>
            </tr>
        </table>

        <h2>Itemized Details</h2>
        <table>
            <thead>
                <tr>
                    <th class="text-left">HSN Code</th>
                    <th class="text-left">Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Taxable Amount</th>
                    <th>SGST %</th>
                    <th>SGST Amount</th>
                    <th>CGST %</th>
                    <th>CGST Amount</th>
                    <th>Total Tax</th>
                    <th>Total Amount</th>
                </tr>
            </thead>
            <tbody>
                ${report.items.map(item => `
                <tr>
                    <td class="text-left">${item.hsnCode}</td>
                    <td class="text-left">${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>${currencyFormat(item.unitPrice)}</td>
                    <td>${currencyFormat(item.taxableAmount)}</td>
                    <td>${item.sgstRate.toFixed(1)}%</td>
                    <td>${currencyFormat(item.sgstAmount)}</td>
                    <td>${item.cgstRate.toFixed(1)}%</td>
                    <td>${currencyFormat(item.cgstAmount)}</td>
                    <td>${currencyFormat(item.totalTaxAmount)}</td>
                    <td>${currencyFormat(item.totalAmount)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <p style="margin-top: 30px; font-size: 12px; color: #666;">
            <strong>Note:</strong> This report is generated for GSTR-1 (Outward Supply) filing purposes.<br>
            Please verify all details and rate calculations before filing with tax authorities.<br>
            SGST + CGST are used for intra-state supplies; IGST for inter-state supplies.
        </p>
    </body>
    </html>
    `;

    return html;
}

/**
 * Formats tax report as CSV for spreadsheet import
 */
export function formatTaxReportAsCSV(report: TaxFilingReport): string {
    let csv = 'Tax Filing Report - GSTR-1\n';
    csv += `Report Date,${report.reportDate}\n`;
    csv += `Period,${report.period}\n\n`;

    csv += 'SUMMARY\n';
    csv += 'Metric,Value\n';
    csv += `Total Items,${report.totalItems}\n`;
    csv += `Total Quantity,${report.totalQuantity}\n`;
    csv += `Total Taxable Amount,₹${report.totalTaxableAmount.toFixed(2)}\n`;
    csv += `Total SGST,₹${report.totalSGST.toFixed(2)}\n`;
    csv += `Total CGST,₹${report.totalCGST.toFixed(2)}\n`;
    csv += `Total IGST,₹${report.totalIGST.toFixed(2)}\n`;
    csv += `Total Tax,₹${report.totalTax.toFixed(2)}\n`;
    csv += `Total Amount,₹${report.totalAmount.toFixed(2)}\n\n`;

    csv += 'ITEMIZED DETAILS\n';
    csv += 'HSN Code,Description,Quantity,Unit Price,Taxable Amount,SGST %,SGST Amount,CGST %,CGST Amount,Total Tax,Total Amount\n';

    report.items.forEach(item => {
        csv += `"${item.hsnCode}","${item.description}",${item.quantity},₹${item.unitPrice.toFixed(2)},₹${item.taxableAmount.toFixed(2)},${item.sgstRate.toFixed(1)},₹${item.sgstAmount.toFixed(2)},${item.cgstRate.toFixed(1)},₹${item.cgstAmount.toFixed(2)},₹${item.totalTaxAmount.toFixed(2)},₹${item.totalAmount.toFixed(2)}\n`;
    });

    return csv;
}

/**
 * Saves a manually entered or newly found GST rate to the cache.
 */
export function saveGstRate(hsnCode: string, rate: number) {
    if (!hsnCode) return;
    const cache = getCache();
    cache[hsnCode.trim()] = rate;
    setCache(cache);
}
