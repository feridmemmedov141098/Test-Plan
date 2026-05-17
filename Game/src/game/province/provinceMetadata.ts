import type { CountryId, ProvinceMetadata, ResourceId, ResourceYields, TerrainType } from './provinceTypes'

export const RESOURCE_IDS: ResourceId[] = ['oil', 'gas', 'metal', 'food', 'industry', 'energy', 'manpower', 'ammunition', 'money']

const AZERBAIJAN_PROVINCE_NAMES: Record<string, string> = {
  AZABS: 'Abşeron',
  AZAGA: 'Ağstafa',
  AZAGC: 'Ağcabədi',
  AZAGM: 'Ağdam',
  AZAGS: 'Ağdaş',
  AZAGU: 'Ağsu',
  AZAST: 'Astara',
  AZBA: 'Bakı',
  AZBAB: 'Babək',
  AZBAL: 'Balakən',
  AZBAR: 'Bərdə',
  AZBEY: 'Beyləqan',
  AZBIL: 'Biləsuvar',
  AZCAB: 'Cəbrayıl',
  AZCAL: 'Cəlilabad',
  AZCUL: 'Culfa',
  AZDAS: 'Daşkəsən',
  AZFUZ: 'Füzuli',
  AZGA: 'Gəncə',
  AZGAD: 'Gədəbəy',
  AZGOR: 'Goranboy',
  AZGOY: 'Göyçay',
  AZGYG: 'Xanlar',
  AZHAC: 'Hajigabul',
  AZIMI: 'İmişli',
  AZISM: 'İsmayıllı',
  AZKAL: 'Kəlbəcər',
  AZKAN: 'Kangarli',
  AZKUR: 'Kürdəmir',
  AZLA: 'Lankaran City',
  AZLAC: 'Lachin',
  AZLAN: 'Lankaran',
  AZLER: 'Lerik',
  AZMAS: 'Masallı',
  AZMI: 'Mingəçevir',
  AZNA: 'Naftalan',
  AZNEF: 'Neftçala',
  AZNX: 'Naxçıvan',
  AZOGU: 'Oğuz',
  AZORD: 'Ordubad',
  AZQAB: 'Qəbələ',
  AZQAX: 'Qax',
  AZQAZ: 'Qazax',
  AZQBA: 'Quba',
  AZQBI: 'Qubadli',
  AZQOB: 'Qobustan',
  AZQUS: 'Qusar',
  AZSA: 'Şəki',
  AZSAB: 'Sabirabad',
  AZSAD: 'Sədərək',
  AZSAH: 'Şahbuz',
  AZSAK: 'Şəki',
  AZSAL: 'Salyan',
  AZSAR: 'Şərur',
  AZSAT: 'Saatlı',
  AZSBN: 'Dəvəçi',
  AZSIY: 'Siyəzən',
  AZSKR: 'Şəmkir',
  AZSM: 'Sumqayıt',
  AZSMI: 'Şamaxı',
  AZSMX: 'Samux',
  AZSR: 'Shirvan',
  AZSUS: 'Şuşa',
  AZTAR: 'Tərtər',
  AZTOV: 'Tovuz',
  AZUCA: 'Ucar',
  AZXA: 'Stepanakert',
  AZXAC: 'Xaçmaz',
  AZXCI: 'Xocalı',
  AZXIZ: 'Xızı',
  AZXVD: 'Xocavənd',
  AZYAR: 'Yardımlı',
  AZYE: 'Yevlakh',
  AZYEV: 'Yevlakh Rayon',
  AZZAN: 'Zəngilan',
  AZZAQ: 'Zaqatala',
  AZZAR: 'Zərdab',
}

const PRIMARY_RESOURCES: Record<ResourceId, string[]> = {
  oil: ['AZABS', 'AZHAC', 'AZKUR', 'AZNA', 'AZNEF', 'AZSAL', 'AZSIY', 'AZSBN'],
  gas: ['AZBIL', 'AZIMI', 'AZQOB', 'AZXIZ', 'AZZAR'],
  metal: ['AZBAL', 'AZCUL', 'AZDAS', 'AZGAD', 'AZKAL', 'AZLAC', 'AZORD', 'AZQBI', 'AZSAH', 'AZSUS', 'AZXCI', 'AZXVD', 'AZZAN', 'AZZAQ'],
  energy: ['AZMI', 'AZSR'],
  industry: ['AZBA', 'AZGA', 'AZLA', 'AZNX', 'AZSM', 'AZYE', 'AZYEV'],
  ammunition: [],
  money: [],
  food: [
    'AZAGA',
    'AZAGC',
    'AZAGM',
    'AZAGS',
    'AZAGU',
    'AZAST',
    'AZBAB',
    'AZBAR',
    'AZBEY',
    'AZCAB',
    'AZCAL',
    'AZFUZ',
    'AZGOR',
    'AZGOY',
    'AZGYG',
    'AZISM',
    'AZKAN',
    'AZLAN',
    'AZLER',
    'AZMAS',
    'AZOGU',
    'AZQAB',
    'AZQAX',
    'AZQAZ',
    'AZQBA',
    'AZQUS',
    'AZSA',
    'AZSAB',
    'AZSAD',
    'AZSAK',
    'AZSAR',
    'AZSAT',
    'AZSKR',
    'AZSMI',
    'AZSMX',
    'AZTAR',
    'AZTOV',
    'AZUCA',
    'AZXA',
    'AZXAC',
    'AZYAR',
  ],
  manpower: [],
}

const ECONOMY_REGIONS: Record<string, string[]> = {
  Absheron: ['AZABS', 'AZBA', 'AZSM', 'AZXIZ'],
  Aran: ['AZAGC', 'AZAGS', 'AZAGU', 'AZBAR', 'AZBEY', 'AZBIL', 'AZFUZ', 'AZGOY', 'AZHAC', 'AZIMI', 'AZKUR', 'AZMI', 'AZNEF', 'AZQOB', 'AZSAB', 'AZSAL', 'AZSAT', 'AZSR', 'AZUCA', 'AZYE', 'AZYEV', 'AZZAR'],
  'Ganja-Gazakh': ['AZAGA', 'AZDAS', 'AZGA', 'AZGAD', 'AZGOR', 'AZGYG', 'AZNA', 'AZQAZ', 'AZSKR', 'AZSMX', 'AZTOV'],
  'Kalbajar-Lachin': ['AZKAL', 'AZLAC', 'AZQBI', 'AZZAN'],
  'Lankaran-Astara': ['AZAST', 'AZCAL', 'AZLA', 'AZLAN', 'AZLER', 'AZMAS', 'AZYAR'],
  Nakhchivan: ['AZBAB', 'AZCUL', 'AZKAN', 'AZNX', 'AZORD', 'AZSAD', 'AZSAH', 'AZSAR'],
  'Mountainous Shirvan': ['AZISM', 'AZQAB', 'AZSMI'],
  'Quba-Khachmaz': ['AZQBA', 'AZQUS', 'AZSBN', 'AZSIY', 'AZXAC'],
  'Shaki-Zagatala': ['AZBAL', 'AZOGU', 'AZQAX', 'AZSA', 'AZSAK', 'AZZAQ'],
  Karabakh: ['AZAGM', 'AZCAB', 'AZSUS', 'AZTAR', 'AZXA', 'AZXCI', 'AZXVD'],
}

const SECONDARY_RESOURCES: Record<string, ResourceId[]> = {
  Absheron: ['industry'],
  Aran: ['food'],
  'Ganja-Gazakh': ['food', 'industry'],
  'Kalbajar-Lachin': ['industry'],
  'Lankaran-Astara': ['food'],
  Nakhchivan: ['food'],
  'Mountainous Shirvan': ['food'],
  'Quba-Khachmaz': ['food'],
  'Shaki-Zagatala': ['food'],
  Karabakh: ['food', 'industry'],
}

const FUEL_PAIR: Partial<Record<ResourceId, ResourceId>> = {
  oil: 'gas',
  gas: 'oil',
}

const TERRAIN_BY_PROVINCE: Partial<Record<string, TerrainType>> = {
  AZBA: 'urban',
  AZGA: 'urban',
  AZSM: 'urban',
  AZMI: 'urban',
  AZLA: 'urban',
  AZNX: 'urban',
  AZSR: 'urban',
  AMER: 'urban',
  AZABS: 'suburban',
  AZYEV: 'suburban',
  AZYE: 'suburban',
  AZNA: 'suburban',
  AZXAC: 'suburban',
  AMKT: 'suburban',
  AZHAC: 'desert',
  AZQOB: 'desert',
  AZSIY: 'desert',
  AZSBN: 'desert',
  AZNEF: 'desert',
  AZSAL: 'desert',
  AZBAB: 'desert',
  AZKAN: 'desert',
  AZSAD: 'desert',
  AZSAR: 'desert',
  AMAR: 'desert',
  AMAV: 'desert',
  AZAGC: 'fields',
  AZAGS: 'fields',
  AZAGU: 'fields',
  AZBAR: 'fields',
  AZBEY: 'fields',
  AZBIL: 'fields',
  AZFUZ: 'fields',
  AZGOY: 'fields',
  AZIMI: 'fields',
  AZKUR: 'fields',
  AZSAB: 'fields',
  AZSAT: 'fields',
  AZUCA: 'fields',
  AZZAR: 'fields',
  AMAG: 'fields',
  AMSH: 'fields',
  AZAGA: 'plains',
  AZGOR: 'plains',
  AZGYG: 'plains',
  AZQAZ: 'plains',
  AZSKR: 'plains',
  AZSMX: 'plains',
  AZTOV: 'plains',
  AZTAR: 'plains',
  AZAGM: 'plains',
  AZCAB: 'plains',
  AZAST: 'forest',
  AZCAL: 'forest',
  AZLAN: 'forest',
  AZLER: 'forest',
  AZMAS: 'forest',
  AZYAR: 'forest',
  AZBAL: 'forest',
  AZOGU: 'forest',
  AZQAX: 'forest',
  AZQBA: 'forest',
  AZQUS: 'forest',
  AZSA: 'forest',
  AZSAK: 'forest',
  AZZAQ: 'forest',
  AZISM: 'forest',
  AZQAB: 'forest',
  AZSMI: 'forest',
  AMLO: 'forest',
  AMTV: 'forest',
  AZDAS: 'hills',
  AZGAD: 'hills',
  AZQBI: 'hills',
  AZXIZ: 'hills',
  AZXCI: 'hills',
  AZXVD: 'hills',
  AZXA: 'hills',
  AMGR: 'hills',
  AZKAL: 'mountain',
  AZLAC: 'mountain',
  AZZAN: 'mountain',
  AZCUL: 'mountain',
  AZORD: 'mountain',
  AZSAH: 'mountain',
  AZSUS: 'mountain',
  AMSU: 'mountain',
  AMVD: 'mountain',
}

export function createEmptyYields(): ResourceYields {
  return {
    oil: 0,
    gas: 0,
    metal: 0,
    food: 0,
    industry: 0,
    energy: 0,
    manpower: 0,
    ammunition: 0,
    money: 0,
  }
}

export function getProvinceMetadata(provinceCode: string, countryId: CountryId): ProvinceMetadata {
  if (countryId === 'armenia') {
    return {
      displayName: provinceCode,
      economyRegion: 'Armenia Placeholder',
      primaryResource: 'food',
      resourceYields: { ...createEmptyYields(), food: 3, metal: 1, manpower: 1 },
      terrainType: getTerrainType(provinceCode, countryId),
    }
  }

  const primaryResource = getPrimaryResource(provinceCode)
  const economyRegion = getEconomyRegion(provinceCode)
  const resourceYields = createEmptyYields()
  resourceYields.manpower = 1
  resourceYields[primaryResource] += 5

  for (const secondaryResource of SECONDARY_RESOURCES[economyRegion] ?? ['food']) {
    if (secondaryResource !== primaryResource) {
      resourceYields[secondaryResource] += 2
    }
  }

  const fuelPair = FUEL_PAIR[primaryResource]

  if (economyRegion === 'Absheron' && fuelPair) {
    resourceYields[fuelPair] += 2
  }

  if (provinceCode === 'AZBA') {
    resourceYields.industry += 5
    resourceYields.oil += 4
    resourceYields.gas += 4
    resourceYields.manpower += 5
  }

  return {
    displayName: AZERBAIJAN_PROVINCE_NAMES[provinceCode] ?? provinceCode,
    economyRegion,
    primaryResource,
    resourceYields,
    terrainType: getTerrainType(provinceCode, countryId),
  }
}

function getTerrainType(provinceCode: string, countryId: CountryId): TerrainType {
  return TERRAIN_BY_PROVINCE[provinceCode] ?? (countryId === 'armenia' ? 'mountain' : 'fields')
}

function getPrimaryResource(provinceCode: string): ResourceId {
  for (const resourceId of RESOURCE_IDS) {
    if (PRIMARY_RESOURCES[resourceId].includes(provinceCode)) {
      return resourceId
    }
  }

  return 'food'
}

function getEconomyRegion(provinceCode: string): string {
  for (const [region, provinceCodes] of Object.entries(ECONOMY_REGIONS)) {
    if (provinceCodes.includes(provinceCode)) {
      return region
    }
  }

  return 'Unassigned'
}
