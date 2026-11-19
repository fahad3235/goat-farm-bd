/* Goat Farm BD \u2014 option lists (test names only, no invented prices/dates). */
(function (root) {
  'use strict';
  var DATA = {
    BREEDS: ['Black Bengal', 'Jamunapari', 'Beetal', 'Boer', 'Cross', 'Other'],
    SEXES: ['buck', 'doe', 'kid'],
    GOAT_STATUSES: ['alive', 'sold', 'dead'],
    HEALTH_KINDS: ['vaccination', 'deworming', 'treatment', 'checkup'],
    COMMON_MEDICINES: [
      'PPR vaccine', 'Goat pox vaccine', 'FMD vaccine', 'Enterotoxemia vaccine',
      'Albendazole', 'Ivermectin', 'Levamisole', 'Oxytetracycline', 'Vitamin B-complex',
    ],
    EXPENSE_CATEGORIES: ['feed', 'medicine', 'transport', 'shelter', 'other'],
    BREEDING_STATUSES: ['expecting', 'kidded', 'failed'],
    STORAGE_KEY: 'goatFarmBD.v1',
    LANG_KEY: 'goatFarmBD.lang',
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
  root.GoatFarmData = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
