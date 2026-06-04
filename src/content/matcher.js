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

    // 1. Differentiate between sub-pickers in Paleo Context (Litho/Bio/Chrono)
    const isLithoInput = labelLower.includes('litho') || labelLower.includes('lito') || nameLower.includes('litho') || nameLower.includes('lito') || ariaLower.includes('litho') || ariaLower.includes('lito') || titleLower.includes('litho') || titleLower.includes('lito') || labelLower.includes('formacion') || labelLower.includes('formation') || labelLower.includes('miembro') || labelLower.includes('member');
    const isBioInput = labelLower.includes('bio') || nameLower.includes('bio') || ariaLower.includes('bio') || titleLower.includes('bio');
    const isChronoInput = labelLower.includes('chrono') || labelLower.includes('crono') || nameLower.includes('chrono') || nameLower.includes('crono') || ariaLower.includes('chrono') || ariaLower.includes('crono') || titleLower.includes('chrono') || titleLower.includes('crono') || labelLower.includes('edad') || labelLower.includes('age') || labelLower.includes('period') || labelLower.includes('epoch') || labelLower.includes('era');

    if (isLithoInput) {
      const lithoKeys = ['formation', 'member', 'group', 'bed', 'lithostratigraphy'];
      if (!lithoKeys.includes(normKey)) return 0;
    }
    if (isBioInput) {
      const bioKeys = ['landmammalage', 'faunalzone', 'zone', 'biostratigraphy'];
      if (!bioKeys.includes(normKey)) return 0;
    }
    if (isChronoInput) {
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
      const isSubform = headingLower.includes('locality') || 
                        headingLower.includes('localidad') || 
                        headingLower.includes('paleo') || 
                        headingLower.includes('geolog') || 
                        headingLower.includes('estratig') ||
                        headingLower.includes('collecting') || 
                        headingLower.includes('colecta') || 
                        headingLower.includes('determina') ||
                        headingLower.includes('prepara') ||
                        headingLower.includes('other identifier') ||
                        headingLower.includes('otros identif');
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

  App.findFieldKey = function(input) {
    const name = input.getAttribute('name');
    if (name) {
      if (name === 'catalogNumber') return 'inventoryNumber';
      if (name === 'altCatalogNumber') return 'inventoryNumber';
      if (name === 'identifier') return 'inventoryNumber';
      if (name === 'institution') return 'collection';
      if (name === 'remarks') return 'description';
      if (name === 'stationFieldNumber') return 'inventoryNumber';
      if (name === 'verbatimDate') return 'dateCreated';
    }

    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      const text = label.textContent.trim().toLowerCase();
      if (text === 'catalog number' || text === 'numero de catalogo' || text === 'nº de catalogo' || text === 'nº catalogo' || text === 'no. catalogo' || text === 'no. de catálogo') return 'inventoryNumber';
      if (text === 'alt cat number' || text === 'alt catalogo') return 'inventoryNumber';
      if (text === 'identifier' || text === 'identificador') return 'inventoryNumber';
      if (text === 'institution' || text === 'institucion' || text === 'institución') return 'collection';
      if ((text === 'remarks' || text === 'observaciones' || text === 'comentarios' || text === 'notas') && input.tagName === 'TEXTAREA') return 'description';
      if (text === 'taxon' || text === 'taxón') return 'taxon';
      if (text === 'genus' || text === 'genero' || text === 'género') return 'genus';
      if (text === 'species' || text === 'especie') return 'species';
      if (text === 'locality' || text === 'locality name' || text === 'localidad' || text === 'nombre de la localidad') return 'origin';
      if (text === 'prepared by' || text === 'preparado por' || text === 'preparador') return 'creator';
      if (text === 'prepared date' || text === 'fecha de preparacion') return 'dateCreated';
      if (text === 'determined date' || text === 'fecha de determinación') return 'dateCreated';
      if (text === 'start date' || text === 'fecha de inicio') return 'dateCreated';
      if (text === 'cataloged date' || text === 'fecha de catalogación') return 'dateCreated';
      if (text === 'method' || text === 'metodo' || text === 'método') return 'method';
      if (text === 'count' || text === 'conteo' || text === 'cantidad') return 'count';
    }

    const aria = (input.getAttribute('aria-label') || '').trim().toLowerCase();
    if (aria) {
      if (aria === 'taxon' || aria === 'taxón') return 'taxon';
      if (aria === 'locality' || aria === 'locality name' || aria === 'localidad') return 'origin';
      if (aria === 'paleo context' || aria === 'contexto paleo') return 'paleoContext';
      if (aria === 'preparer' || aria === 'prepared by' || aria === 'preparador') return 'creator';
      if (aria === 'collector' || aria === 'cataloger' || aria === 'determiner' || aria === 'colector' || aria === 'catalogador' || aria === 'determinador') return 'creator';
    }

    const title = (input.getAttribute('title') || '').toLowerCase();
    const fs = input.closest('fieldset');
    const heading = fs ? (fs.querySelector('h3, h4, legend')?.textContent || '').toLowerCase() : '';

    if (title.includes('locality name') || title.includes('nombre de la localidad')) return 'origin';
    if (title.includes('prep type') || title.includes('tipo de prep')) return 'prepType';
    if (title.includes('prepared by') || title.includes('preparado por')) return 'creator';
    if (title.includes('full name') && /determination|determinac/i.test(heading)) return 'taxon';

    return null;
  };

  App.findValueInCapturedData = function(input) {
    if (!App.lastCapturedData) return null;
    
    const fieldKey = App.findFieldKey(input);
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
