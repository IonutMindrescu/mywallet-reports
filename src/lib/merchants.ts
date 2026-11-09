import { stripDiacritics } from './parser';

/** Known brands: pattern → [display name, category id]. Order matters (first match wins). */
export const BRANDS: Array<[RegExp, string, string]> = [
  // Consumer lenders paid by card (BNPL / IFN) — before eMAG etc. ("PayU*twisto_eMAG.ro")
  [/twisto/, 'Twisto', 'loans'],
  [/heyblu/, 'Heyblu', 'loans'],
  [/\btbi\b/, 'TBI Bank', 'loans'],
  [/mokka/, 'Mokka', 'loans'],
  [/paypo\b/, 'PayPo', 'loans'],
  [/klarna/, 'Klarna', 'loans'],
  [/leanpay/, 'Leanpay', 'loans'],
  [/credius|provident|ferratum|viva credit|cetelem/, '', 'loans'],
  // Food delivery (before transport — "bolt food" vs "bolt")
  [/glovo/, 'Glovo', 'delivery'],
  [/tazz/, 'Tazz', 'delivery'],
  [/wolt/, 'Wolt', 'delivery'],
  [/foodpanda/, 'Foodpanda', 'delivery'],
  [/bolt\s*food/, 'Bolt Food', 'delivery'],
  // Groceries
  [/kaufland/, 'Kaufland', 'groceries'],
  [/\blidl/, 'Lidl', 'groceries'],
  [/mega\s*image|\bmega\b/, 'Mega Image', 'groceries'],
  [/carrefour/, 'Carrefour', 'groceries'],
  [/auchan/, 'Auchan', 'groceries'],
  [/\bprofi\b/, 'Profi', 'groceries'],
  [/penny/, 'Penny', 'groceries'],
  [/\bcora\b/, 'Cora', 'groceries'],
  [/selgros/, 'Selgros', 'groceries'],
  [/\bmetro\b(?!rex)/, 'Metro', 'groceries'],
  [/la doi pasi/, 'La Doi Pași', 'groceries'],
  [/annabella/, 'Annabella', 'groceries'],
  [/freshful/, 'Freshful', 'groceries'],
  [/sezamo/, 'Sezamo', 'groceries'],
  [/bringo/, 'Bringo', 'groceries'],
  [/supeco/, 'Supeco', 'groceries'],
  [/\bartima\b/, 'Artima', 'groceries'],
  [/linella/, 'Linella', 'groceries'],
  [/market\b|minimarket|supermarket|alimentar|magazin mixt/, '', 'groceries'],
  // Restaurants & coffee
  [/mc\s*donald|\bmcd\b/, "McDonald's", 'restaurants'],
  [/\bkfc\b/, 'KFC', 'restaurants'],
  [/burger king/, 'Burger King', 'restaurants'],
  [/starbucks/, 'Starbucks', 'restaurants'],
  [/5\s*to\s*go/, '5 to go', 'restaurants'],
  [/ted'?s coffee/, "Ted's Coffee", 'restaurants'],
  [/tucano/, 'Tucano Coffee', 'restaurants'],
  [/salad box/, 'Salad Box', 'restaurants'],
  [/subway/, 'Subway', 'restaurants'],
  [/pizza hut/, 'Pizza Hut', 'restaurants'],
  [/spartan/, 'Spartan', 'restaurants'],
  [/fornetti/, 'Fornetti', 'restaurants'],
  [/la placinte/, 'La Plăcinte', 'restaurants'],
  [/restaurant|bistro|trattoria|pizz|shaorma|kebab|cafe\b|caffe|coffee|cofetarie|patiserie|brutarie|baker|placint|gelat|grill|burger|sushi|bar\b|pub\b|taverna|braseri|lounge|hanul|pescari|cartof|wurst|yumm|kitchen|food ?court|fast ?food|terasa|cantina|crama/, '', 'restaurants'],
  [/\bdelivery\b/, '', 'delivery'],
  // Transport
  [/\bbolt\b/, 'Bolt', 'transport'],
  [/\buber\b/, 'Uber', 'transport'],
  [/free\s*now/, 'FreeNow', 'transport'],
  [/\bstb\b|metrorex|ratb|\bctp\b|\brat\b|ratbv|tursib|transurb|musatinii|eltrans|ctpcj|bilet transport/, 'Transport public', 'transport'],
  [/\bcfr\b|regio calatori|astra trans/, 'CFR', 'transport'],
  [/24pay|tpark|amparcat|parcar|parking|park\b|confort urban/, 'Parcare', 'transport'],
  [/roviniet|cnair|taxa de pod/, 'Rovinietă / taxe drum', 'auto'],
  [/taxi/, 'Taxi', 'transport'],
  [/\blime\b|\btier\b|\bbird\b/, 'Trotinete', 'transport'],
  // Fuel
  [/\bomv\b/, 'OMV', 'fuel'],
  [/petrom/, 'Petrom', 'fuel'],
  [/\bmol\b/, 'MOL', 'fuel'],
  [/rompetrol/, 'Rompetrol', 'fuel'],
  [/lukoil/, 'Lukoil', 'fuel'],
  [/socar/, 'Socar', 'fuel'],
  [/gazprom/, 'Gazprom', 'fuel'],
  [/bemol/, 'Bemol', 'fuel'],
  [/benzin|carburant|statie peco|\bpeco\b/, '', 'fuel'],
  // Subscriptions & streaming
  [/netflix/, 'Netflix', 'subscriptions'],
  [/spotify/, 'Spotify', 'subscriptions'],
  [/\bhbo|max\.com|hbomax/, 'HBO Max', 'subscriptions'],
  [/disney/, 'Disney+', 'subscriptions'],
  [/youtube/, 'YouTube Premium', 'subscriptions'],
  [/google\s*(one|storage)|google\s*\*?\s*gsuite|google workspace/, 'Google One', 'subscriptions'],
  [/apple\.com|icloud|itunes/, 'Apple', 'subscriptions'],
  [/voyo/, 'Voyo', 'subscriptions'],
  [/skyshowtime/, 'SkyShowtime', 'subscriptions'],
  [/prime video|amazon prime/, 'Amazon Prime', 'subscriptions'],
  [/openai|chatgpt/, 'ChatGPT', 'subscriptions'],
  [/anthropic|claude\.ai/, 'Claude', 'subscriptions'],
  [/microsoft|\bxbox\b/, 'Microsoft', 'subscriptions'],
  [/adobe/, 'Adobe', 'subscriptions'],
  [/dropbox/, 'Dropbox', 'subscriptions'],
  [/playstation|sony interactive/, 'PlayStation', 'subscriptions'],
  [/steam/, 'Steam', 'entertainment'],
  [/audible/, 'Audible', 'subscriptions'],
  [/canva/, 'Canva', 'subscriptions'],
  [/github/, 'GitHub', 'subscriptions'],
  [/patreon/, 'Patreon', 'subscriptions'],
  [/cyberfolks|hostinger|godaddy|namecheap|\brotld\b|cloudflare|digitalocean|hetzner|vercel|netlify|jetbrains|notion|figma/, '', 'subscriptions'],
  // Telecom
  [/orange/, 'Orange', 'telecom'],
  [/vodafone/, 'Vodafone', 'telecom'],
  [/telekom/, 'Telekom', 'telecom'],
  [/\bdigi\b|rcs|\brds\b/, 'Digi', 'telecom'],
  // Utilities
  [/\benel\b/, 'Enel', 'utilities'],
  [/engie/, 'Engie', 'utilities'],
  [/\be\.?on\b/, 'E.ON', 'utilities'],
  [/hidroelectrica/, 'Hidroelectrica', 'utilities'],
  [/electrica/, 'Electrica', 'utilities'],
  [/apa nova|apavital|aquatim|compania de apa/, 'Apă', 'utilities'],
  [/\bppc\b/, 'PPC', 'utilities'],
  [/termoenergetica|radet|veolia|termo/, 'Termoficare', 'utilities'],
  [/nova power|premier energy|\bcez\b/, 'Energie', 'utilities'],
  [/intretinere|asociatia de proprietari|e-bloc|xbloc|urbica/, 'Întreținere', 'utilities'],
  // Online shopping & couriers
  [/emag\.ro|\bemag\b|_emag/, 'eMAG', 'online'],
  [/amazon|amzn/, 'Amazon', 'online'],
  [/aliexpress/, 'AliExpress', 'online'],
  [/\btemu\b/, 'Temu', 'online'],
  [/shein/, 'Shein', 'online'],
  [/\bolx\b/, 'OLX', 'online'],
  [/fashion\s*days/, 'Fashion Days', 'fashion'],
  [/sameday/, 'Sameday', 'online'],
  [/fan\s*courier/, 'FAN Courier', 'online'],
  [/cargus/, 'Cargus', 'online'],
  [/\bdpd\b/, 'DPD', 'online'],
  [/vinted/, 'Vinted', 'online'],
  [/easybox/, 'Easybox', 'online'],
  // Fashion
  [/\bzara\b/, 'Zara', 'fashion'],
  [/\bh\s*&\s*m\b|\bhm\b|hennes/, 'H&M', 'fashion'],
  [/bershka/, 'Bershka', 'fashion'],
  [/pull\s*&?\s*bear/, 'Pull&Bear', 'fashion'],
  [/stradivarius/, 'Stradivarius', 'fashion'],
  [/reserved/, 'Reserved', 'fashion'],
  [/\bc\s*&\s*a\b/, 'C&A', 'fashion'],
  [/lc waikiki/, 'LC Waikiki', 'fashion'],
  [/pepco/, 'Pepco', 'fashion'],
  [/sinsay/, 'Sinsay', 'fashion'],
  [/deichmann/, 'Deichmann', 'fashion'],
  [/about\s*you/, 'About You', 'fashion'],
  [/answear/, 'Answear', 'fashion'],
  [/\bnike\b/, 'Nike', 'fashion'],
  [/adidas/, 'Adidas', 'fashion'],
  [/massimo dutti/, 'Massimo Dutti', 'fashion'],
  [/\bmango\b/, 'Mango', 'fashion'],
  [/primark/, 'Primark', 'fashion'],
  [/new yorker/, 'New Yorker', 'fashion'],
  [/\bkik\b/, 'KiK', 'fashion'],
  [/lefties/, 'Lefties', 'fashion'],
  [/couture|croitor|incaltamint|boutique/, '', 'fashion'],
  // Home
  [/\bikea/, 'IKEA', 'home'],
  [/dedeman/, 'Dedeman', 'home'],
  [/leroy\s*merlin/, 'Leroy Merlin', 'home'],
  [/hornbach/, 'Hornbach', 'home'],
  [/brico/, 'Brico Depot', 'home'],
  [/\bjysk\b/, 'JYSK', 'home'],
  [/mobexpert/, 'Mobexpert', 'home'],
  [/\bjumbo\b/, 'Jumbo', 'home'],
  [/\baction\b/, 'Action', 'home'],
  [/\bkika\b/, 'Kika', 'home'],
  // Electronics
  [/altex/, 'Altex', 'electronics'],
  [/media\s*galaxy/, 'Media Galaxy', 'electronics'],
  [/flanco/, 'Flanco', 'electronics'],
  [/pc\s*garage/, 'PC Garage', 'electronics'],
  [/evomag/, 'evoMAG', 'electronics'],
  [/istyle/, 'iStyle', 'electronics'],
  [/bambu ?lab/, 'Bambu Lab', 'electronics'],
  [/gsmnet/, 'GSMnet', 'electronics'],
  [/electronic|\bgsm\b|3d ?print|sigmanortec|optimus digital|robofun/, '', 'electronics'],
  // Health
  [/catena/, 'Catena', 'health'],
  [/dr\.?\s*max/, 'Dr. Max', 'health'],
  [/help\s*net/, 'HelpNet', 'health'],
  [/sensiblu/, 'Sensiblu', 'health'],
  [/farmacia tei/, 'Farmacia Tei', 'health'],
  [/regina maria/, 'Regina Maria', 'health'],
  [/medlife/, 'MedLife', 'health'],
  [/sanador/, 'Sanador', 'health'],
  [/synevo/, 'Synevo', 'health'],
  [/farma|pharma|clinica|medical|stomatolog|dental|optic|laborator/, '', 'health'],
  // Beauty
  [/notino/, 'Notino', 'beauty'],
  [/sephora/, 'Sephora', 'beauty'],
  [/douglas/, 'Douglas', 'beauty'],
  [/\bdm\b.*drogerie|drogerie/, 'dm', 'beauty'],
  [/yves rocher/, 'Yves Rocher', 'beauty'],
  [/salon|frizer|barber|coafor|beauty|nails|cosmetic/, '', 'beauty'],
  // Entertainment
  [/cinema city/, 'Cinema City', 'entertainment'],
  [/happy cinema/, 'Happy Cinema', 'entertainment'],
  [/iabilet/, 'iaBilet', 'entertainment'],
  [/eventim/, 'Eventim', 'entertainment'],
  [/cinema|teatr|muzeu|bowling|escape|concert|bilet|live events|agrement|karting|paintball|smash|parc de distractii/, '', 'entertainment'],
  // Gaming
  [/hellcase|cs\.?money|csvt|skinport|\bg2g\b|\bg2a\b|faceit|epic ?games|riot ?games|blizzard|battle\.net|nintendo|ubisoft|roblox|gog\.com/, '', 'entertainment'],
  // Travel
  [/booking/, 'Booking.com', 'travel'],
  [/airbnb/, 'Airbnb', 'travel'],
  [/wizz/, 'Wizz Air', 'travel'],
  [/ryanair/, 'Ryanair', 'travel'],
  [/tarom/, 'TAROM', 'travel'],
  [/hotel|hostel|pensiune|cazare|resort|travel|vola\.ro|esky|expedia|aeroport|airport/, '', 'travel'],
  // Education
  [/udemy/, 'Udemy', 'education'],
  [/coursera/, 'Coursera', 'education'],
  [/carturesti/, 'Cărturești', 'education'],
  [/elefant/, 'Elefant', 'education'],
  [/libris/, 'Libris', 'education'],
  [/diverta/, 'Diverta', 'education'],
  [/librari|scoala|universit|curs\b|academia/, '', 'education'],
  // Sport
  [/world\s*class/, 'World Class', 'sport'],
  [/18\s*gym/, '18GYM', 'sport'],
  [/stay\s*fit/, 'Stay Fit', 'sport'],
  [/decathlon/, 'Decathlon', 'sport'],
  [/sport ?vision/, 'Sport Vision', 'sport'],
  [/intersport/, 'Intersport', 'sport'],
  [/hervis/, 'Hervis', 'sport'],
  [/sportisimo/, 'Sportisimo', 'sport'],
  [/\bgym\b|fitness|padel|tenis|\bbike\b|sala de sport/, '', 'sport'],
  // Kids
  [/noriel/, 'Noriel', 'kids'],
  [/smyk/, 'Smyk', 'kids'],
  [/jucari|toys|gradinita|bebe/, '', 'kids'],
  // Pets
  [/animax/, 'Animax', 'pets'],
  [/zooplus/, 'Zooplus', 'pets'],
  [/petmart|maxi\s*pet|\bpet\b|veterin/, '', 'pets'],
  // Car
  [/dacia|skoda|renault|volkswagen|\bvw\b|toyota|hyundai|\bford\b|service auto|auto[\s-]?(soft|service|part|shop)|\bauto\b|automobil|anvelop|autonom|vulcaniz|\bitp\b|spalatorie|car ?wash|certcar|piese auto|autodoc|\brar\b/, '', 'auto'],
  // Taxes
  [/ghiseul|anaf|impozit|taxe locale|dgitl|primaria|amenda|(^|:)\s*municipiul\b|consiliul local|\bdits\b/, 'Taxe & impozite', 'taxes'],
  // Insurance
  [/allianz/, 'Allianz-Țiriac', 'insurance'],
  [/groupama/, 'Groupama', 'insurance'],
  [/omniasig/, 'Omniasig', 'insurance'],
  [/generali/, 'Generali', 'insurance'],
  [/asirom/, 'Asirom', 'insurance'],
  [/signal iduna/, 'Signal Iduna', 'insurance'],
  [/nn asigurari/, 'NN', 'insurance'],
  [/asigur|\brca\b|casco|reasig|\basig\b/, '', 'insurance'],
  // Tobacco & kiosks
  [/inmedio|\binm\b/, 'Inmedio', 'tobacco'],
  [/\brelay\b/, 'Relay', 'tobacco'],
  [/tabac|tutun|iqos|\bglo\b|vape|tiger shop/, '', 'tobacco'],
  // Gifts & donations
  [/florar|\bflori\b|flower|fleurop|donati|fundatia|caritabil|speranta|unicef|crucea rosie|salvati copiii/, '', 'gifts'],
  // Wallets
  [/revolut/, 'Revolut', 'wallets'],
  [/paypal/, 'PayPal', 'online'],
];

const PROCESSORS = /^(payu|paypal|sumup|sq|zettle|ztl|netopia|mobilpay|euplatesc|ep|stripe|google|gpay|apple pay|vivawallet|viva)\s*\*\s*/i;

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/&(])([a-zăâîșț])/g, (_, a, b) => a + b.toUpperCase());

export function merchantKey(s: string): string {
  // Word order is ignored so "Popescu Ion" and "Ion Popescu" (bank formats differ by direction) match.
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');
}

const NAMED = BRANDS.filter((b) => b[1]);
const GENERIC = BRANDS.filter((b) => !b[1]);

/** Look up a known brand in free text: named brands first, then generic keywords ("market", "restaurant"…). */
export function findBrand(text: string): [string, string] | null {
  const t = stripDiacritics(text).toLowerCase();
  for (const list of [NAMED, GENERIC]) {
    for (const [re, name, cat] of list) {
      if (re.test(t)) return [name, cat];
    }
  }
  return null;
}

/** Clean a raw counterparty string into a display name. */
export function cleanCounterparty(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  s = s.split(/\s{2,}/)[0];
  if (PROCESSORS.test(s)) s = s.replace(PROCESSORS, '');
  else if (s.includes('*')) {
    const after = s.split('*').slice(1).join(' ').trim();
    if (after.length >= 3) s = after;
  }
  s = s
    .replace(/\s+(RO|ROU|ROMANIA)$/i, '')
    .replace(/\s+[A-Z]{0,3}\d{3,}[\w\-]*.*$/i, '')
    .replace(/\s+(SRL|S\.R\.L\.?|SA|S\.A\.?|SRL-D)\b\.?/gi, '')
    .replace(/[\s.,\-]+$/, '')
    .trim();
  if (!s) s = raw.trim();
  if (/\.[a-z]{2,4}$/i.test(s) && !s.includes(' ')) return s.toLowerCase();
  return titleCase(s);
}

export function normalizeMerchant(counterparty: string, type: string, details: string[]): string {
  const brand = findBrand(counterparty || '');
  if (brand && brand[0]) return brand[0];
  const cleaned = cleanCounterparty(counterparty);
  if (cleaned) return cleaned;
  // Only card payments may borrow a brand from details (round-ups/transfers mention other merchants there).
  if (/pos|card|comerciant|utilitati/i.test(type) && !/round|transfer/i.test(type)) {
    const brand2 = findBrand(details.join(' '));
    if (brand2 && brand2[0]) return brand2[0];
  }
  return titleCase(type || 'Necunoscut');
}
