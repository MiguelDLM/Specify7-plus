(function(App) {
  'use strict';

  App.KEY_ALIASES = {
    stratigraphy: ['paleocontext', 'lithostratigraphy', 'chronostratigraphy', 'contextopaleo', 'litoestratigrafia', 'cronoestratigrafia'],
    lithostratigraphy: ['paleocontext', 'lithostratigraphy', 'contextopaleo', 'litoestratigrafia'],
    biostratigraphy: ['paleocontext', 'biostratigraphy', 'contextopaleo', 'bioestratigrafia'],
    chronostratigraphy: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    formation: ['paleocontext', 'lithostratigraphy', 'contextopaleo', 'litoestratigrafia'],
    member: ['paleocontext', 'lithostratigraphy', 'contextopaleo', 'litoestratigrafia'],
    group: ['paleocontext', 'lithostratigraphy', 'contextopaleo', 'litoestratigrafia'],
    bed: ['paleocontext', 'lithostratigraphy', 'contextopaleo', 'litoestratigrafia'],
    geologicalage: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    age: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    period: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    epoch: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    era: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    systemperiod: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    seriesepoch: ['paleocontext', 'chronostratigraphy', 'contextopaleo', 'cronoestratigrafia'],
    landmammalage: ['paleocontext', 'biostratigraphy', 'contextopaleo', 'bioestratigrafia'],
    faunalzone: ['paleocontext', 'biostratigraphy', 'contextopaleo', 'bioestratigrafia'],
    zone: ['paleocontext', 'biostratigraphy', 'contextopaleo', 'bioestratigrafia'],

    locality: ['locality', 'localityname', 'localidad', 'nombrelocalidad'],
    site: ['locality', 'localityname', 'localidad'],
    sitename: ['locality', 'localityname', 'localidad'],
    sitekey: ['stationfieldnumber', 'localitycode', 'collectornumber', 'clavedesitio'],
    latitude: ['latitude1', 'lat', 'latitud'],
    longitude: ['longitude1', 'lng', 'lon', 'longitud'],
    namedplace: ['locality', 'localityname', 'localidad'],

    collector: ['collectors', 'agent', 'lastname', 'colector', 'colectores'],
    collectors: ['collectors', 'agent', 'lastname', 'colector', 'colectores'],
    determiner: ['determiner', 'lastname', 'determinador'],
    cataloger: ['cataloger', 'lastname', 'catalogador'],
    preparator: ['preparedby', 'lastname', 'preparador'],
    preparedby: ['preparedby', 'lastname', 'preparador'],

    class: ['taxon', 'fullname', 'clase'],
    order: ['taxon', 'fullname', 'orden'],
    family: ['taxon', 'fullname', 'familia'],
    subfamily: ['taxon', 'fullname', 'subfamilia'],
    tribe: ['taxon', 'fullname', 'tribu'],
    genus: ['taxon', 'fullname', 'genero', 'género'],
    subgenus: ['taxon', 'fullname', 'subgenero', 'subgénero'],
    species: ['taxon', 'fullname', 'especie'],
    scientificname: ['taxon', 'fullname', 'nombrecientifico', 'nombrecientífico'],

    natureofspecimen: ['naturedescription', 'description', 'preservation', 'naturalezadelamuestra', 'descripcion'],
    specimentype: ['typestatus', 'tipodeejemplar'],
    typestatus: ['typestatus', 'estadodeeltipo'],
    isondisplay: ['onloan', 'available', 'enexposicion'],
    ispublished: ['ispublished', 'published', 'publicado'],
    objectstatus: ['inventorystatus', 'objectcondition', 'estadodelobjeto'],
    status: ['inventorystatus', 'objectcondition', 'estado'],

    startdateyear: ['startdate', 'fecha'],
    enddateyear: ['enddate'],
    collectiondate: ['startdate', 'fechadecolecta'],
    datecollected: ['startdate', 'fechadecolecta'],
  };

  App.ALIAS_PENALTY = 0.9;
  App.DEFAULT_PRIORITY = 50;

  App.KEY_PRIORITY = {
    taxon: 0, scientificname: 0,
    formation: 1, lithostratigraphy: 1,
    member: 2, group: 2, bed: 2,
    landmammalage: 3, faunalzone: 4, zone: 5,
    seriesepoch: 6, systemperiod: 7,
    geologicalage: 8, series: 8, epoch: 8, period: 9, era: 9, age: 9,
    chronostratigraphy: 20, biostratigraphy: 20, stratigraphy: 21,
    genus: 30, species: 30, subgenus: 31,
    class: 40, order: 40, family: 40, subfamily: 40, tribe: 40,
  };

  App.keyPriority = function(key) {
    const k = App.normalizeString(key);
    return App.KEY_PRIORITY[k] != null ? App.KEY_PRIORITY[k] : App.DEFAULT_PRIORITY;
  };

  App.getMatchScore = function(input, key, labelText) {
    const normKey = App.normalizeString(key);
    if (!normKey) return 0;

    const fs = input.closest('fieldset');
    const heading = fs ? (fs.querySelector('h3, h4, legend')?.textContent || '').toLowerCase() : '';

    const labelLower = (labelText || '').toLowerCase();
    const nameLower = (input.getAttribute('name') || '').toLowerCase();
    const ariaLower = (input.getAttribute('aria-label') || '').toLowerCase();
    const titleLower = (input.getAttribute('title') || '').toLowerCase();
    const headingLower = heading.toLowerCase();

    // 1. Differentiate between sub-pickers in Paleo Context (Litho/Bio/Chrono).
    //    Match on whole words only: substring matching wrongly flags fields like
    //    "Storage"/"Image" (contain "age") or "Mineral" (contains "era") as
    //    chronostratigraphy and then blocks every other key from filling them.
    const geoHaystack = `${labelLower} ${nameLower} ${ariaLower} ${titleLower}`;
    const hasWord = (word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(geoHaystack);

    // Order matters: a "Land Mammal Age" field reads as bio, not chrono, so the
    // bio test is evaluated before the chrono test and the kinds are exclusive.
    let geoKind = null;
    if (hasWord('litho') || hasWord('lito') || hasWord('formation') || hasWord('formacion') ||
        hasWord('member') || hasWord('miembro') || hasWord('group') || hasWord('grupo') ||
        hasWord('bed')) {
      geoKind = 'litho';
    } else if (hasWord('bio') || hasWord('biostratigraphy') || hasWord('bioestratigrafia') ||
               hasWord('faunal') || hasWord('mammal') || hasWord('zone')) {
      geoKind = 'bio';
    } else if (hasWord('chrono') || hasWord('crono') || hasWord('age') || hasWord('edad') ||
               hasWord('period') || hasWord('periodo') || hasWord('epoch') || hasWord('epoca') ||
               hasWord('era') || hasWord('series') || hasWord('serie')) {
      geoKind = 'chrono';
    }

    if (geoKind === 'litho') {
      const lithoKeys = ['formation', 'member', 'group', 'bed', 'lithostratigraphy'];
      if (!lithoKeys.includes(normKey)) return 0;
    } else if (geoKind === 'bio') {
      const bioKeys = ['landmammalage', 'faunalzone', 'zone', 'biostratigraphy'];
      if (!bioKeys.includes(normKey)) return 0;
    } else if (geoKind === 'chrono') {
      const chronoKeys = ['systemperiod', 'seriesepoch', 'geologicalage', 'age', 'period', 'epoch', 'era', 'chronostratigraphy'];
      if (!chronoKeys.includes(normKey)) return 0;
    }

    // 2. Differentiate between Agent fields (Collector vs Determiner vs Cataloger vs Preparator)
    const isCollectorInput = labelLower.includes('collector') || nameLower.includes('collector') || ariaLower.includes('collector') || titleLower.includes('collector') || headingLower.includes('collecting') || headingLower.includes('colecta') || headingLower.includes('collector');
    const isDeterminerInput = labelLower.includes('determiner') || nameLower.includes('determiner') || ariaLower.includes('determiner') || titleLower.includes('determiner') || headingLower.includes('determination') || headingLower.includes('determinac') || headingLower.includes('determiner');
    const isPreparatorInput = labelLower.includes('prepared by') || labelLower.includes('preparator') || nameLower.includes('preparedby') || ariaLower.includes('prepared') || titleLower.includes('prepared') || headingLower.includes('preparation') || headingLower.includes('preparac');

    if (isCollectorInput) {
      const collectorKeys = ['collector', 'collectors'];
      if (!collectorKeys.includes(normKey) && ['determiner', 'cataloger', 'preparedby', 'preparator', 'creator'].includes(normKey)) return 0;
    }
    if (isDeterminerInput) {
      const determinerKeys = ['determiner'];
      if (!determinerKeys.includes(normKey) && ['collector', 'collectors', 'cataloger', 'preparedby', 'preparator', 'creator'].includes(normKey)) return 0;
    }
    if (isPreparatorInput) {
      const preparatorKeys = ['preparedby', 'preparator', 'creator'];
      if (!preparatorKeys.includes(normKey) && ['collector', 'collectors', 'determiner', 'cataloger'].includes(normKey)) return 0;
    }

    // 3. Restrict general remarks/description to the main form, avoiding subforms
    const isGeneralRemarkKey = normKey === 'remarks' || normKey === 'description';
    if (isGeneralRemarkKey) {
      const subformHeadings = [
        'locality', 'localidad',
        'paleo', 'geolog', 'estratig', 'stratig',
        'collecting', 'colecta',
        'determina',
        'prepara',
        'attribute', 'atributo',
        'host', 'hospedador',
        'taphonom', 'tafonom',
        'other identifier', 'otros identif',
        'relationship', 'relacion',
        'component', 'componente'
      ];
      const isSubform = subformHeadings.some(h => headingLower.includes(h));
      if (isSubform) return 0;
    }

    const normName = App.normalizeString(input.getAttribute('name'));
    const normId = App.normalizeString(input.getAttribute('id'));
    const normLabel = App.normalizeString(labelText);
    const normAria = App.normalizeString(input.getAttribute('aria-label'));
    const normTitle = App.normalizeString(input.getAttribute('title'));
    const normPlaceholder = App.normalizeString(input.getAttribute('placeholder'));

    const checkMatch = (normVal, baseScore, targetKey) => {
      if (!normVal) return 0;
      if (normVal === targetKey) {
        return baseScore + 2;
      }
      if (normVal.includes(targetKey) || targetKey.includes(normVal)) {
        const ratio = Math.min(normVal.length, targetKey.length) / Math.max(normVal.length, targetKey.length);
        let score = baseScore * 0.6 * ratio;
        if (normVal.startsWith(targetKey) || normVal.endsWith(targetKey) || targetKey.startsWith(normVal) || targetKey.endsWith(normVal)) {
          score += 0.5;
        }
        return score;
      }
      return 0;
    };

    const scoreTarget = (targetKey) => {
      let s = 0;
      s = Math.max(s, checkMatch(normName, 10, targetKey));
      s = Math.max(s, checkMatch(normAria, 9.5, targetKey));
      s = Math.max(s, checkMatch(normId, 9, targetKey));
      s = Math.max(s, checkMatch(normLabel, 8, targetKey));
      s = Math.max(s, checkMatch(normTitle, 7, targetKey));
      s = Math.max(s, checkMatch(normPlaceholder, 6, targetKey));
      return s;
    };

    let bestScore = scoreTarget(normKey);
    for (const alias of (App.KEY_ALIASES[normKey] || [])) {
      bestScore = Math.max(bestScore, scoreTarget(alias) * App.ALIAS_PENALTY);
    }

    return bestScore;
  };

  App.getInputLabelText = function(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }

    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();
    
    const parent = input.parentElement;
    if (parent) {
      const labelsInParent = parent.querySelectorAll('label');
      for (const lbl of labelsInParent) {
        if (lbl.textContent.trim()) return lbl.textContent.trim();
      }
      
      let prev = input.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'LABEL' || prev.classList.contains('control-label') || prev.classList.contains('label')) {
          if (prev.textContent.trim()) return prev.textContent.trim();
        }
        if (prev.textContent && prev.textContent.trim().length > 1 && prev.textContent.trim().length < 50) {
          if (!prev.contains(input)) return prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
      }
    }
    
    const formRow = input.closest('.grid') || input.closest('tr') || input.closest('.flex');
    if (formRow) {
      const labels = formRow.querySelectorAll('label, .label, .control-label');
      if (labels.length === 1 && labels[0].textContent.trim()) {
        return labels[0].textContent.trim();
      }
      
      const inputWrapper = input.closest('.col-span-1') || input.closest('td') || input.parentElement;
      if (inputWrapper) {
        let cellPrev = inputWrapper.previousElementSibling;
        if (cellPrev) {
          const lbl = cellPrev.querySelector('label, .label, .control-label') || cellPrev;
          if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
        }
      }
    }
    
    return '';
  };

  App.findValueInCapturedData = function(input) {
    if (!App.lastCapturedData) return null;

    const labelText = App.getInputLabelText(input);
    const keys = Object.keys(App.lastCapturedData);

    let bestKey = null;
    let bestScore = 0;

    for (const key of keys) {
      const score = App.getMatchScore(input, key, labelText);
      if (score < 1.5) continue;
      if (score > bestScore || (score === bestScore && bestKey && App.keyPriority(key) < App.keyPriority(bestKey))) {
        bestScore = score;
        bestKey = key;
      }
    }

    if (bestKey) {
      return App.lastCapturedData[bestKey];
    }

    return null;
  };

})(window.Specify7Plus = window.Specify7Plus || {});
