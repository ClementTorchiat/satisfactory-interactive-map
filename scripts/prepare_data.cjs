const fs = require('fs');
const path = require('path');

// Ensure public directories exist
fs.mkdirSync(path.join(__dirname, '../public/data'), { recursive: true });

// Copy icons sprite sheet
fs.copyFileSync(
  path.join(__dirname, 'icons.png'),
  path.join(__dirname, '../public/icons.png')
);

const mapDataRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'mapData.json'), 'utf8'));
const locationsRaw = JSON.parse(fs.readFileSync(path.join(__dirname, 'locations.json'), 'utf8'));

// Build icon offsets map from icons.css
const iconsCss = fs.readFileSync(path.join(__dirname, 'icons.css'), 'utf8');
const iconOffsets = {};
const iconRegex = /\.icon-([a-zA-Z0-9_-]+)\s*\{\s*background-position:\s*0px\s*(-?\d+)px;/g;
let m;
while ((m = iconRegex.exec(iconsCss)) !== null) {
  iconOffsets[m[1]] = Math.abs(parseInt(m[2], 10)); // in 18px units
}

console.log('Parsed icon offsets count:', Object.keys(iconOffsets).length);

// Extract categories and groups
const groups = mapDataRaw.groups.map(g => {
  let color = g.color.startsWith('#') ? g.color : `#${g.color}`;
  // User request: Change normal resources color to orange instead of dark blue
  if (g.title === 'Resources: Normal' || g.id === 2564) {
    color = '#FF9800';
  }
  return {
    id: g.id,
    title: g.title,
    order: g.order,
    color,
    categories: g.categories.map(c => {
      const offset = iconOffsets[c.icon] !== undefined ? iconOffsets[c.icon] : 0;
      return {
        id: c.id,
        groupId: g.id,
        title: c.title,
        icon: c.icon,
        iconOffset: offset,
        iconIndex: Math.round(offset / 18),
        totalCount: c.locations_count
      };
    })
  };
});

const categoriesById = {};
groups.forEach(g => {
  g.categories.forEach(c => {
    categoriesById[c.id] = {
      ...c,
      groupTitle: g.title,
      groupColor: g.color
    };
  });
});

// Clean locations
const locations = locationsRaw.locations.map(loc => {
  const cat = categoriesById[loc.category_id] || {};
  return {
    id: loc.id,
    categoryId: loc.category_id,
    categoryTitle: cat.title || 'Unknown',
    groupTitle: cat.groupTitle || 'General',
    groupColor: cat.groupColor || '#BA8E23',
    icon: cat.icon || 'point_of_interest',
    title: loc.title || cat.title || 'Marker',
    description: loc.description || '',
    lat: parseFloat(loc.latitude),
    lng: parseFloat(loc.longitude),
    media: (loc.media || []).map(med => ({
      url: med.url,
      title: med.title || ''
    }))
  };
});

// Category counts verification
const countsByCat = {};
locations.forEach(l => {
  countsByCat[l.categoryId] = (countsByCat[l.categoryId] || 0) + 1;
});

groups.forEach(g => {
  g.categories.forEach(c => {
    c.count = countsByCat[c.id] || c.totalCount || 0;
    if (categoriesById[c.id]) {
      categoriesById[c.id].count = c.count;
      categoriesById[c.id].totalCount = c.count;
    }
  });
});

const output = {
  mapInfo: {
    id: mapDataRaw.map.id,
    title: 'Satisfactory MASSAGE-2(A-B)b',
    slug: mapDataRaw.map.slug,
    initialZoom: 11.5,
    minZoom: 8,
    maxZoom: 15,
    center: [-0.8239487529888, 0.65839815513634],
    bounds: [-1.4, 0, 0, 1.4],
    tilesUrl: 'https://tiles.mapgenie.io/games/satisfactory/massage-2a-bb/default-v1/{z}/{y}/{x}.jpg'
  },
  groups,
  categoriesById,
  iconOffsets,
  locations
};

fs.writeFileSync(
  path.join(__dirname, '../public/data/map-data.json'),
  JSON.stringify(output)
);

console.log('Successfully generated public/data/map-data.json');
console.log('Total locations:', locations.length);
console.log('Total groups:', groups.length);
