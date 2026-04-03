// ==========================================
// --- CONFIGURATION GLOBALE DÉMOGRAPHIE  ---
// ==========================================
const geojsonUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/geojson/carte.geojson';
const csvDepensesUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/depenses_euro.csv';
const csvPopUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/population.csv'; 
const csvAgeUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/pyramide_age.csv';
const csvBienEtreUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/bien_etre.csv';
const csvDefUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/definition_categeories_depense.csv';
const csvPibUrl = 'https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/csv/pib.csv';

const couleurMin = "#e2e8f0";
const couleurMax = "#475569";
const couleurVide = "#f1f5f9";
const couleurFemmes = "#d29ca8"; 
const couleurHommes = "#8ba3c2"; 
const couleursAge = ["#cbd5e1", "#94a3b8", "#475569"]; 

let geoData = [];
let geojsonGlobal = null;
let dataDepensesGlobal = [];
let categoriesParPays = {}; 
let totauxParPays = {}; 
let populationParPays = {}; 
let ageParPays = {}; 
let santeParPaysEtAnnee = {}; 
let satisfactionParPaysEtAnnee = {};
let definitionsCategories = {};
let categorieActuelle = "";
let pibParPaysEtAnnee = {};
let competencesParPaysEtAnnee = {};
let modeCalculPage1 = "pourcentage";

function nettoyerMontant(val) {
    if (!val) return 0;
    let s = String(val).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const nb = parseFloat(s);
    return isNaN(nb) ? 0 : nb;
}

// ==========================================
// --- CHARGEMENT DES DONNÉES             ---
// ==========================================
Promise.all([
    d3.json(geojsonUrl),
    d3.dsv(";", csvDepensesUrl),
    d3.dsv(";", csvPopUrl),      
    d3.dsv(";", csvAgeUrl),
    d3.dsv(";", csvBienEtreUrl),
    d3.dsv(";", csvDefUrl),
    d3.dsv(";", csvPibUrl)
]).then(([geojson, csvData, popData, ageData, bienEtreData, defData, pibData]) => {
    
    geojsonGlobal = geojson;
    dataDepensesGlobal = csvData; 
    geoData = geojson.features.slice(0, 19); 
    const categoriesSet = new Set();

    // 1. Dépenses
    csvData.forEach(d => {
        const nomPays = d.pays;
        const categorie = d.depense_cat_courte;
        const annee = d.annee || d.year || d.TIME_PERIOD; 
        const typeLigne = d.total ? d.total.trim().toLowerCase() : ""; 
        const montant = nettoyerMontant(d.montant);
        
        if (nomPays && annee && montant > 0) {
            if (!categoriesParPays[nomPays]) categoriesParPays[nomPays] = {};
            if (!categoriesParPays[nomPays][annee]) categoriesParPays[nomPays][annee] = {};
            if (!totauxParPays[nomPays]) totauxParPays[nomPays] = {};
            
            if (typeLigne === "total") {
                totauxParPays[nomPays][annee] = (totauxParPays[nomPays][annee] || 0) + montant;
            } else if (typeLigne === "sous-total" && categorie) {
                categoriesParPays[nomPays][annee][categorie] = (categoriesParPays[nomPays][annee][categorie] || 0) + montant;
                categoriesSet.add(categorie);
            }
        }
    });


    // 2. Santé, Bien-être & Éducation
    bienEtreData.forEach(d => {
        const nomPays = d.pays ? d.pays.trim() : "";
        const annee = parseInt(d.annee);
        
        const mesure = d.mesure ? d.mesure.trim() : "";
        const unite = d.cde_unite ? d.cde_unite.trim() : "";
        const domaine = d.cde_domaine ? d.cde_domaine.trim() : "";
        
        let rawVal = d.valeur_mesuree || d.montant || d.valeur || "";
        const valeur = nettoyerMontant(rawVal);

        if (nomPays && annee) {
            
            // 1. Santé
            if (mesure === "Etat de sante percu comme bon" && valeur > 0) {
                if (!santeParPaysEtAnnee[nomPays]) santeParPaysEtAnnee[nomPays] = {};
                santeParPaysEtAnnee[nomPays][annee] = valeur; 
            } 
            // 2. Satisfaction
            else if (unite === "0_TO_10" && domaine === "HSL_11" && valeur > 0) {
                if (!satisfactionParPaysEtAnnee[nomPays]) satisfactionParPaysEtAnnee[nomPays] = {};
                satisfactionParPaysEtAnnee[nomPays][annee] = valeur * 10; 
            }
            
            // --- 3. COMPÉTENCES DES ÉLÈVES (Ultra-tolérant) ---
            
            if (mesure.toLowerCase().includes("competence")) {
                
                
                let scoreStr = String(rawVal).replace(/\s/g, '').replace(',', '.');
                let scorePisa = parseFloat(scoreStr);
                
                
                if (!isNaN(scorePisa) && scorePisa > 100) {
                    if (!competencesParPaysEtAnnee[nomPays]) competencesParPaysEtAnnee[nomPays] = {};
                    if (!competencesParPaysEtAnnee[nomPays][annee]) competencesParPaysEtAnnee[nomPays][annee] = {};
                    
                    if (mesure.toLowerCase().includes("math")) {
                        competencesParPaysEtAnnee[nomPays][annee].maths = scorePisa;
                    } else if (mesure.toLowerCase().includes("ecrit") || mesure.toLowerCase().includes("lecture")) {
                        competencesParPaysEtAnnee[nomPays][annee].lecture = scorePisa;
                    } else if (mesure.toLowerCase().includes("science")) {
                        competencesParPaysEtAnnee[nomPays][annee].sciences = scorePisa;
                    }
                }
            }
        }
    });



    // 3. Population
    popData.forEach(d => {
        const nomPays = d.pays;
        const annee = parseInt(d.annee);
        const nbHommes = nettoyerMontant(d.hommes); 
        const nbFemmes = nettoyerMontant(d.femmes);

        if (nomPays && annee) {
            if (!populationParPays[nomPays]) populationParPays[nomPays] = {};
            populationParPays[nomPays][annee] = { hommes: nbHommes, femmes: nbFemmes, total: nbHommes + nbFemmes };
        }
    });

    // 4. Âge
    ageData.forEach(d => {
        const nomPays = d.pays ? d.pays.trim() : "";
        const annee = parseInt(d.annee);
        const sexe = d.sexe ? d.sexe.trim().toLowerCase() : ""; 
        const codeAge = d.cde_age ? d.cde_age.trim() : ""; 
        const valeur = nettoyerMontant(d.valeur_mesuree);

        let trancheAge = "";
        if (codeAge === "Y_LT15") trancheAge = "< 15 ans";
        else if (codeAge === "Y15T64") trancheAge = "15 - 64 ans";
        else if (codeAge === "Y_GE65") trancheAge = "> 65 ans";

        if (nomPays && annee && sexe === "total" && trancheAge !== "" && valeur > 0) {
            if (!ageParPays[nomPays]) ageParPays[nomPays] = {};
            if (!ageParPays[nomPays][annee]) ageParPays[nomPays][annee] = [];
            ageParPays[nomPays][annee].push({ age: trancheAge, valeur: valeur });
        }
    });

    // 5. Définitions
    defData.forEach(d => {
        const cat = d.depense_cat_courte ? d.depense_cat_courte.trim() : "";
        const def = d.definition ? d.definition.trim() : "";
        if (cat && def) definitionsCategories[cat] = def;
    });

    if (pibData) {
        pibData.forEach(d => {
            const nomPays = d.pays;
            const annee = parseInt(d.annee);
            const montant = nettoyerMontant(d.montant || d.valeur_mesuree);
            if (nomPays && annee && montant > 0) {
                if (!pibParPaysEtAnnee[nomPays]) pibParPaysEtAnnee[nomPays] = {};
                pibParPaysEtAnnee[nomPays][annee] = montant;
            }
        });
    }

    // --- INITIALISATION DE L'INTERFACE ---
    const categories = Array.from(categoriesSet).sort();
    const conteneurFiltres = d3.select("#liste-filtres");
    
    conteneurFiltres.selectAll(".filtre-item")
        .data(categories)
        .enter()
        .append("div")
        .attr("class", "filtre-item")
        .text(d => d)
        .on("mouseover", function(event, d) {
            const tooltip = d3.select("#tooltip");
            tooltip.html("").append("div").attr("class", "tooltip-titre").text(d);
            
            if (definitionsCategories[d]) {
                tooltip.append("div")
                    .style("margin-top", "5px").style("font-size", "11px")
                    .style("font-weight", "400").style("color", "#475569")
                    .style("max-width", "250px").style("white-space", "normal")
                    .style("line-height", "1.4")
                    .text(definitionsCategories[d]);
            }
            tooltip.classed("visible", true);
        })
        .on("mousemove", function(event) { 
            d3.select("#tooltip").style("left", (event.pageX - 320) + "px").style("top", (event.pageY + 40) + "px");
        })
        .on("mouseout", function() { cacherInfobulle(); })
        .on("click", function(event, d) {
            categorieActuelle = d;
            conteneurFiltres.selectAll(".filtre-item").classed("actif", false);
            d3.select(this).classed("actif", true);
            mettreAJourDonnees(categorieActuelle);
            
            
            d3.select("#panneau-lateral").classed("ouvert", false);
        });

    dessinerGrille(geoData);

    initClignotementPays();

    if(categories.length > 0) {
        categorieActuelle = categories[0];
        conteneurFiltres.select(".filtre-item").classed("actif", true); 
        mettreAJourDonnees(categorieActuelle);
    }

    
    d3.select("#btn-toggle-panneau").on("click", function() {
        const panneau = d3.select("#panneau-lateral");
        const estOuvert = panneau.classed("ouvert");
        panneau.classed("ouvert", !estOuvert);
    });



    // --- INITIALISATION DE LA PAGE 2 (Le Dashboard) ---
    const selectFiltrePays = d3.select("#filtre-pays");
    
    
    const tousLesPays = Object.keys(totauxParPays).filter(p => p && p.trim() !== "").sort(); 
    
    
    selectFiltrePays.html(""); 
    tousLesPays.forEach(p => selectFiltrePays.append("option").attr("value", p).text(p));
    
    
    if (tousLesPays.length > 0) {
        const paysParDefaut = tousLesPays[0]; 
        selectFiltrePays.property("value", paysParDefaut); 
        mettreAJourDashboard(paysParDefaut); 
    }

    
    selectFiltrePays.on("change", function() {
        mettreAJourDashboard(this.value);
    });

    initPage3();

}).catch(error => console.error("Erreur de chargement des données :", error));


// ==========================================
// --- FONCTIONS CARTE (PAGE 1)           ---
// ==========================================
function dessinerGrille(features) {
    const conteneur = d3.select("#grille-pays");
    conteneur.html(""); 

    const blocsPays = conteneur.selectAll(".pays-container")
        .data(features).enter().append("div")
        .attr("class", "pays-container").style("order", (d, i) => i); 

    blocsPays.each(function(d) {
        const div = d3.select(this);
        const projection = d3.geoMercator().fitSize([100, 100], d);
        const path = d3.geoPath().projection(projection);
        const nomGeo = d.properties.NAME ? d.properties.NAME : "inconnu";
        const idPropre = nomGeo.replace(/[^a-zA-Z]/g, "");

        div.append("svg").attr("class", "pays-svg").attr("viewBox", "0 0 100 100")
           .append("path")
           .attr("d", path)
           .attr("fill", couleurMin)
           .attr("id", "path-" + idPropre)
           .attr("stroke", nomGeo === "France" ? "#cc0c4c" : "#ffffff")
           .attr("stroke-width", nomGeo === "France" ? "1px" : "1px");

        div.append("div").attr("class", "pays-nom").text(nomGeo); 
        div.append("div").attr("class", "pays-valeur").text("-");

        div.on("mouseover", function(event) {
            d3.select(this).select("path").attr("fill", "#94a3b8");
            
            // --- 1. CALCUL DES DONNÉES FINANCIÈRES (2023) ---
            let sousCats = {};
            let totalM = 0;
            
            dataDepensesGlobal.filter(d => 
                d.pays === nomGeo && 
                d.depense_cat_courte === categorieActuelle && 
                d.total && d.total.trim().toLowerCase() === "sous-total" &&
                d.annee == 2023 
            ).forEach(d => {
                const sc = d.depense_courte || "Autre";
                const val = nettoyerMontant(d.montant);
                if (!sousCats[sc]) sousCats[sc] = 0;
                sousCats[sc] += val;
                totalM += val;
            });

            // --- 2. L'INFOBULLE (Suit la souris avec le montant) ---
            const tooltip = d3.select("#tooltip");
            tooltip.html("");
            
            // 1. Le titre : Nom du pays + (2023)
            tooltip.append("div")
                .attr("class", "tooltip-titre")
                .style("margin-bottom", "2px") 
                .text(nomGeo + " (2023)");
                
            // 2. La catégorie juste en dessous
            tooltip.append("div")
                .style("font-size", "11px")
                .style("color", "#64748b")
                .style("margin-bottom", "8px")
                .style("font-weight", "500")
                .text(categorieActuelle);
            
            // 3. On affiche le montant total
            
            
            if (totalM > 0) {
                tooltip.append("div")
                    .style("color", "#0CBBCC")
                    .style("font-weight", "bold")
                    .style("font-size", "12px")
                    .text("Total : " + totalM.toLocaleString("fr-FR", {maximumFractionDigits: 2}) + " M€");
            } else {
                tooltip.append("div")
                    .style("color", "#94a3b8")
                    .style("font-style", "italic")
                    .style("font-size", "11px")
                    .text("Montant N/D");
            }

            const pop2023 = (populationParPays[nomGeo] && populationParPays[nomGeo][2023]) ? populationParPays[nomGeo][2023].total : null;
            if (pop2023) {
                tooltip.append("div")
                    .style("color", "#64748b")
                    .style("font-size", "11px")
                    .style("margin-top", "6px")
                    .style("border-top", "1px dashed #cbd5e1")
                    .style("padding-top", "4px")
                    .text("Population : " + (pop2023 / 1000000).toFixed(1) + " M hab.");
            }
            tooltip.classed("visible", true);

            // --- 3. LE PANNEAU FIXE (Détails financiers, en bas à gauche) ---
            const conteneurFixe = d3.select("#details-hover-container");
            conteneurFixe.html("");
            conteneurFixe.append("div")
                .style("font-size", "12px")
                .style("font-weight", "600")
                .style("color", "#334155")
                .style("margin-bottom", "8px")
                .style("border-bottom", "2px solid #0CBBCC")
                .style("padding-bottom", "4px")
                .style("display", "inline-block")
                .text(nomGeo + " (" + categorieActuelle + ")");

            const clesSousCats = Object.keys(sousCats);
            if (clesSousCats.length > 0) {
                const sousCatsTriees = Object.entries(sousCats).sort((a, b) => b[1] - a[1]);
                
                sousCatsTriees.forEach(([nom, val]) => {
                    conteneurFixe.append("div")
                        .style("font-size", "11px")
                        .style("display", "flex")
                        .style("justify-content", "space-between")
                        .style("width", "100%")
                        .style("margin-bottom", "3px")
                        .html(`
                            <span style="color: #475569; text-align: left; flex: 1; padding-right: 15px;">${nom}</span> 
                            <strong style="text-align: right; white-space: nowrap;">${val.toLocaleString("fr-FR", {maximumFractionDigits: 2})} M€</strong>
                        `);
                });
                
                conteneurFixe.append("div")
                    .style("font-size", "11px")
                    .style("margin-top", "6px")
                    .style("padding-top", "4px")
                    .style("border-top", "1px solid #e2e8f0")
                    .style("display", "flex")
                    .style("justify-content", "space-between")
                    .style("width", "100%")
                    .html(`
                        <strong style="text-align: left; flex: 1;">Total Catégorie</strong> 
                        <strong style="color:#0CBBCC; text-align: right; white-space: nowrap;">${totalM.toLocaleString("fr-FR", {maximumFractionDigits: 2})} M€</strong>
                    `);
            } else {
                conteneurFixe.append("div")
                    .style("font-size", "11px")
                    .style("color", "#94a3b8")
                    .style("font-style", "italic")
                    .text("Détail en M€ non disponible");
            }
            
            conteneurFixe.classed("visible", true);
        })
        .on("mousemove", deplacerInfobulle) 
        .on("mouseout", function() {
            const couleurMemoire = d3.select(this).select("path").attr("data-color") || couleurVide;
            d3.select(this).select("path").attr("fill", couleurMemoire);
            cacherInfobulle();
            
            d3.select("#details-hover-container").classed("visible", false);
        })
        .on("click", function() {
            cacherInfobulle(); 
            d3.select("#details-hover-container").classed("visible", false); 
            d3.select("#filtre-pays").property("value", nomGeo);
            mettreAJourDashboard(nomGeo);
            document.getElementById("page-2").scrollIntoView({ behavior: "smooth" }); 
        });
    });
}

/*function mettreAJourDonnees(categorie) {

    d3.select("#titre-categorie-dynamique").html(`Catégorie : <span style="color:#0CBBCC;">${categorie}</span>`);

    const valeursParPays = {};
    let toutesLesValeurs = [];
    let dataPourTri = []; 

    for (let pays in totauxParPays) {
        let sommeTotalGlobale = 0;
        let sommeCategorieGlobale = 0;

        for (let annee in totauxParPays[pays]) sommeTotalGlobale += totauxParPays[pays][annee];

        if (categoriesParPays[pays]) {
            for (let annee in categoriesParPays[pays]) {
                if (categoriesParPays[pays][annee][categorie] !== undefined) {
                    sommeCategorieGlobale += categoriesParPays[pays][annee][categorie];
                }
            }
        }

        if (sommeTotalGlobale > 0) {
            const pourcentageFinal = (sommeCategorieGlobale / sommeTotalGlobale) * 100;
            valeursParPays[pays] = pourcentageFinal;
            toutesLesValeurs.push(pourcentageFinal);
        }
    }

    let echelleCouleur = () => couleurVide;
    if (toutesLesValeurs.length > 0) {
        const minVal = d3.min(toutesLesValeurs);
        const maxVal = d3.max(toutesLesValeurs);
        echelleCouleur = d3.scaleLinear().domain([minVal, maxVal]).range([couleurMin, couleurMax]);
        d3.select("#legende-min").text(minVal.toFixed(1) + " %");
        d3.select("#legende-max").text(maxVal.toFixed(1) + " %");
    }

    geoData.forEach(d => {
        const nomGeo = d.properties.NAME;
        const valTri = valeursParPays[nomGeo] !== undefined ? valeursParPays[nomGeo] : -1;
        dataPourTri.push({ pays: nomGeo, valeur: valTri });
    });

    dataPourTri.sort((a, b) => b.valeur - a.valeur);
    const rangsPays = {};
    dataPourTri.forEach((d, i) => { rangsPays[d.pays] = i; });

    d3.selectAll(".pays-container").each(function(d) {
        const div = d3.select(this);
        const nomGeo = d.properties.NAME; 
        const valeur = valeursParPays[nomGeo];
        const rangFinal = rangsPays[nomGeo]; 

        div.transition().duration(200).style("opacity", 0).on("end", function() {
            div.style("order", rangFinal);
            if (valeur !== undefined) {
                const couleur = echelleCouleur(valeur);
                div.select("path").attr("fill", couleur).attr("data-color", couleur); 
                div.select(".pays-valeur").text(valeur.toFixed(1) + " %"); 
            } else {
                div.select("path").attr("fill", couleurVide).attr("data-color", couleurVide);
                div.select(".pays-valeur").text("N/D");
            }
            div.transition().delay(rangFinal * 25).duration(400).style("opacity", 1);
        });
    });
}
    */

function mettreAJourDonnees(categorie) {

    d3.select("#titre-categorie-dynamique").html(`Catégorie : <span style="color:#0CBBCC;">${categorie}</span>`);

    const valeursParPays = {};
    let toutesLesValeurs = [];
    let dataPourTri = []; 

    for (let pays in totauxParPays) {
        let sommeTotalGlobale = 0;
        let sommeCategorieGlobale = 0;
        let sommePopGlobale = 0;

        for (let annee in totauxParPays[pays]) {
            sommeTotalGlobale += totauxParPays[pays][annee];
        }

        if (categoriesParPays[pays]) {
            for (let annee in categoriesParPays[pays]) {
                if (categoriesParPays[pays][annee][categorie] !== undefined) {
                    sommeCategorieGlobale += categoriesParPays[pays][annee][categorie];
                    // NOUVEAU : On cumule la population pour calculer la moyenne par habitant
                    if (populationParPays[pays] && populationParPays[pays][annee]) {
                        sommePopGlobale += populationParPays[pays][annee].total;
                    }
                }
            }
        }

        // --- NOUVEAU : LE CHOIX DU CALCUL ---
        if (modeCalculPage1 === "pourcentage") {
            if (sommeTotalGlobale > 0) {
                const pourcentageFinal = (sommeCategorieGlobale / sommeTotalGlobale) * 100;
                valeursParPays[pays] = pourcentageFinal;
                toutesLesValeurs.push(pourcentageFinal);
            }
        } else if (modeCalculPage1 === "habitant") {
            if (sommePopGlobale > 0 && sommeCategorieGlobale > 0) {
                // (M€ * 1 000 000) / Population
                const parHabitant = (sommeCategorieGlobale * 1000000) / sommePopGlobale;
                valeursParPays[pays] = parHabitant;
                toutesLesValeurs.push(parHabitant);
            }
        }
    }

    let echelleCouleur = () => couleurVide;
    if (toutesLesValeurs.length > 0) {
        const minVal = d3.min(toutesLesValeurs);
        const maxVal = d3.max(toutesLesValeurs);
        echelleCouleur = d3.scaleLinear().domain([minVal, maxVal]).range([couleurMin, couleurMax]);
        
        // --- NOUVEAU : On adapte la légende en bas à droite ---
        if (modeCalculPage1 === "pourcentage") {
            d3.select("#legende-min").text(minVal.toFixed(1) + " %");
            d3.select("#legende-max").text(maxVal.toFixed(1) + " %");
        } else {
            d3.select("#legende-min").text(minVal.toLocaleString("fr-FR", {maximumFractionDigits:0}) + " €/hab");
            d3.select("#legende-max").text(maxVal.toLocaleString("fr-FR", {maximumFractionDigits:0}) + " €/hab");
        }
    }

    geoData.forEach(d => {
        const nomGeo = d.properties.NAME;
        const valTri = valeursParPays[nomGeo] !== undefined ? valeursParPays[nomGeo] : -1;
        dataPourTri.push({ pays: nomGeo, valeur: valTri });
    });

    dataPourTri.sort((a, b) => b.valeur - a.valeur);
    const rangsPays = {};
    dataPourTri.forEach((d, i) => { rangsPays[d.pays] = i; });

    d3.selectAll(".pays-container").each(function(d) {
        const div = d3.select(this);
        const nomGeo = d.properties.NAME; 
        const valeur = valeursParPays[nomGeo];
        const rangFinal = rangsPays[nomGeo]; 

        div.transition().duration(200).style("opacity", 0).on("end", function() {
            div.style("order", rangFinal);
            if (valeur !== undefined) {
                const couleur = echelleCouleur(valeur);
                div.select("path").attr("fill", couleur).attr("data-color", couleur); 
                
                // --- NOUVEAU : On adapte l'affichage de la valeur sous le pays ---
                if (modeCalculPage1 === "pourcentage") {
                    div.select(".pays-valeur").text(valeur.toFixed(1) + " %"); 
                } else {
                    div.select(".pays-valeur").text(valeur.toLocaleString("fr-FR", {maximumFractionDigits:2}) + " €"); 
                }
                
            } else {
                div.select("path").attr("fill", couleurVide).attr("data-color", couleurVide);
                div.select(".pays-valeur").text("N/D");
            }
            div.transition().delay(rangFinal * 25).duration(400).style("opacity", 1);
        });
    });
}

//function deplacerInfobulle(event) { d3.select("#tooltip").style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"); }
function deplacerInfobulle(event) { 
    const tooltip = d3.select("#tooltip");
    
    
    const tooltipWidth = tooltip.node().getBoundingClientRect().width || 200; 
    
    let positionX = event.pageX + 15; // Position normale (à droite de la souris)
    
    
    if (positionX + tooltipWidth > window.innerWidth - 20) {
       
        positionX = event.pageX - tooltipWidth - 15;
    }
    
    tooltip
        .style("left", positionX + "px")
        .style("top", (event.pageY - 20) + "px"); 
}
function cacherInfobulle() { d3.select("#tooltip").classed("visible", false); }

// ==========================================
// --- SCROLL ET BOUTONS DE NAVIGATION    ---
// ==========================================
window.addEventListener("scroll", function() {
    const btnP1 = document.getElementById("btn-remonter"); // Bouton Page 2 -> Page 1
    const btnP2 = document.getElementById("btn-remonter-p2"); // Bouton Page 3 -> Page 2
    const panneau = document.getElementById("panneau-lateral"); 
    const page3 = document.getElementById("page-3");
    
    const positionPage3 = page3.getBoundingClientRect().top;

    // 1. SI ON EST SUR LA PAGE 3
    if (positionPage3 < window.innerHeight / 2) {
        if(btnP1) btnP1.classList.remove("visible"); // On CACHE la remontée vers P1
        if(btnP2) btnP2.classList.add("visible");    // On AFFICHE la remontée vers P2
        if(panneau) {
            panneau.classList.add("masque-scroll");
            panneau.classList.remove("ouvert");
        }
    } 
    // 2. SI ON EST SUR LA PAGE 2
    else if (window.scrollY > window.innerHeight / 2) {
        if(btnP1) btnP1.classList.add("visible");    // On AFFICHE la remontée vers P1
        if(btnP2) btnP2.classList.remove("visible"); // On CACHE la remontée vers P2
        if(panneau) {
            panneau.classList.add("masque-scroll"); 
            panneau.classList.remove("ouvert");     
        }
    } 
    // 3. SI ON EST TOUT EN HAUT (PAGE 1)
    else {
        if(btnP1) btnP1.classList.remove("visible"); // On CACHE tout
        if(btnP2) btnP2.classList.remove("visible"); 
        if(panneau) {
            panneau.classList.remove("masque-scroll"); 
        }
    }
});

// Clic : remonter de Page 2 à Page 1
d3.select("#btn-remonter").on("click", function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Clic : descendre de Page 2 à Page 3
d3.select("#btn-descendre").on("click", function() {
    document.getElementById("page-3").scrollIntoView({ behavior: 'smooth' });
});

// NOUVEAU Clic : remonter de Page 3 à Page 2
d3.select("#btn-remonter-p2").on("click", function() {
    document.getElementById("page-2").scrollIntoView({ behavior: 'smooth' });
});

// ==========================================
// --- DASHBOARD (PAGE 2)                 ---
// ==========================================
function mettreAJourDashboard(selection) {
    dessinerSurfacePopulation("#pop-donut-container", selection);
    dessinerSurfaceAge("#age-bar-container", selection);
    dessinerPaysIsole("#pays-isole-container", selection);
    dessinerSunburst("#chart-repartition", selection, dataDepensesGlobal);
    mettreAJourTexteDynamique(selection);
    dessinerLineBienEtre("#bien-etre-line-container", selection);
    dessinerGraphiqueCompetences(selection);
}

// --- GRAPHIQUES DE SURFACES ---
function dessinerSurfacePopulation(targetId, selection) {
    const conteneur = d3.select(targetId);
    conteneur.html(""); 
    //d3.select(".card-sexe").style("background-color", "#f8fafc", "important");
    const nomPays = (selection === "Global") ? "Global (Europe)" : selection;
    
    let dataPop = [];
    if (populationParPays[nomPays]) {
        for (let annee = 2002; annee <= 2024; annee++) {
            if (populationParPays[nomPays][annee]) {
                dataPop.push({
                    annee: annee, hommes: populationParPays[nomPays][annee].hommes,
                    femmes: populationParPays[nomPays][annee].femmes, total: populationParPays[nomPays][annee].total
                });
            }
        }
    }

    if (dataPop.length === 0) {
        conteneur.html("<div style='display:flex; justify-content:center; align-items:center; width:100%; height:100%; font-size: 11px; color: #94a3b8; font-style: italic;'>Données N/D</div>");
        return;
    }

    const margin = {top: 10, right: 35, bottom: 15, left: 25}; 
    const width = 180 - margin.left - margin.right; 
    const height = 105 - margin.top - margin.bottom;

    const svg = conteneur.append("svg").attr("width", "100%").attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const stack = d3.stack().keys(["hommes", "femmes"]);
    const series = stack(dataPop);
    const x = d3.scaleLinear().domain(d3.extent(dataPop, d => d.annee)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(dataPop, d => d.total)]).range([height, 0]);
    const colorScale = d3.scaleOrdinal().domain(["hommes", "femmes"]).range([couleurHommes, couleurFemmes]);

    const area = d3.area().x(d => x(d.data.annee)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);

    svg.selectAll("path.area").data(series).enter().append("path").attr("class", "area").attr("d", area).style("fill", d => colorScale(d.key)).style("opacity", 0.9);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues([2002, 2024]).tickFormat(d3.format("d")).tickSize(0))
        .call(g => g.select(".domain").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5)).selectAll("text").style("font-size", "9px").style("fill", "#94a3b8").attr("dy", "8px");

    svg.append("g").call(d3.axisLeft(y).ticks(3).tickFormat(d => (d / 1000000).toFixed(0) + "M").tickSize(0))
        .call(g => g.select(".domain").remove()).selectAll("text").style("font-size", "9px").style("fill", "#94a3b8");

    const data2024 = dataPop[dataPop.length - 1]; 
    if (data2024) {
        const midHommes = data2024.hommes / 2;
        const midFemmes = data2024.hommes + (data2024.femmes / 2);
        svg.append("text").attr("x", width + 4).attr("y", y(midHommes)).attr("dy", "0.35em").style("font-size", "9px").style("font-weight", "600").style("fill", couleurHommes).text((data2024.hommes / 1000000).toFixed(1) + "M");
        svg.append("text").attr("x", width + 4).attr("y", y(midFemmes)).attr("dy", "0.35em").style("font-size", "9px").style("font-weight", "600").style("fill", couleurFemmes).text((data2024.femmes / 1000000).toFixed(1) + "M");
    }

    const ligneVerticale = svg.append("line").style("display", "none").attr("stroke", "#64748b").attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("y1", 0).attr("y2", height);
    svg.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
        .on("mouseover", () => ligneVerticale.style("display", null)).on("mouseout", () => { ligneVerticale.style("display", "none"); cacherInfobulle(); })
        .on("mousemove", function(event) {
            const point = dataPop.find(d => d.annee === Math.round(x.invert(d3.pointer(event, this)[0])));
            if (point) {
                ligneVerticale.attr("x1", x(point.annee)).attr("x2", x(point.annee));
                const tooltip = d3.select("#tooltip");
                tooltip.html("").append("div").attr("class", "tooltip-titre").text("Année " + point.annee);
                tooltip.append("div").style("color", couleurFemmes).style("font-weight", "bold").style("font-size", "11px").text(`Femmes : ${(point.femmes / 1000000).toFixed(2)} M (${((point.femmes / point.total) * 100).toFixed(1)}%)`);
                tooltip.append("div").style("color", couleurHommes).style("font-weight", "bold").style("font-size", "11px").text(`Hommes : ${(point.hommes / 1000000).toFixed(2)} M (${((point.hommes / point.total) * 100).toFixed(1)}%)`);
                tooltip.append("div").style("color", "#475569").style("margin-top", "4px").style("border-top", "1px solid #e2e8f0").style("padding-top", "4px").text(`Total : ${(point.total / 1000000).toFixed(2)} M`);
                tooltip.classed("visible", true); deplacerInfobulle(event);
            }
        });
}

function dessinerSurfaceAge(targetId, selection) {
    const conteneur = d3.select(targetId);
    conteneur.html(""); 
    //d3.select(".card-age").style("background-color", "#f8fafc", "important");
    const nomPays = (selection === "Global") ? "Global (Europe)" : selection;

    let dataAgeHist = [];
    const ordreFixe = ["< 15 ans", "15 - 64 ans", "> 65 ans"]; 

    if (ageParPays[nomPays]) {
        const anneesDispo = Object.keys(ageParPays[nomPays]).map(Number).sort((a, b) => a - b);
        anneesDispo.forEach(annee => {
            let entry = { annee: annee, total: 0 };
            ordreFixe.forEach(k => entry[k] = 0);
            ageParPays[nomPays][annee].forEach(d => { if (ordreFixe.includes(d.age)) { entry[d.age] += d.valeur; entry.total += d.valeur; }});
            if (entry.total > 0) dataAgeHist.push(entry);
        });
    }

    if (dataAgeHist.length === 0) {
        conteneur.html("<div style='display:flex; justify-content:center; align-items:center; width:100%; height:100%; font-size: 11px; color: #94a3b8; font-style: italic;'>Données N/D</div>");
        return;
    }

    const margin = {top: 15, right: 45, bottom: 20, left: 30}; 
    const width = 270 - margin.left - margin.right; 
    const height = 160 - margin.top - margin.bottom;

    const svg = conteneur.append("svg").attr("width", "100%").attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const stack = d3.stack().keys(ordreFixe);
    const series = stack(dataAgeHist);
    const x = d3.scaleLinear().domain(d3.extent(dataAgeHist, d => d.annee)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(dataAgeHist, d => d.total)]).range([height, 0]);
    const colorScale = d3.scaleOrdinal().domain(ordreFixe).range(couleursAge); 
    const area = d3.area().x(d => x(d.data.annee)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);

    svg.selectAll("path.area").data(series).enter().append("path").attr("class", "area").attr("d", area).style("fill", d => colorScale(d.key)).style("opacity", 0.9);

    //svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(d3.extent(dataAgeHist, d => d.annee)).tickFormat(d3.format("d")).tickSize(0))
    //    .call(g => g.select(".domain").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5)).selectAll("text").style("font-size", "13px").style("fill", "#94a3b8").attr("dy", "12px");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(d3.extent(dataAgeHist, d => d.annee)).tickFormat(d3.format("d")).tickSize(0))
        .call(g => g.select(".domain").remove()).selectAll("text").style("font-size", "13px").style("fill", "#94a3b8").attr("dy", "12px");

    svg.append("g").call(d3.axisLeft(y).ticks(3).tickFormat(d => (d / 1000000).toFixed(0) + "M").tickSize(0)).call(g => g.select(".domain").remove()).selectAll("text").style("font-size", "13px").style("fill", "#94a3b8");

    const dataFin = dataAgeHist[dataAgeHist.length - 1]; 
    if (dataFin) {
        let cumulY = 0;
        ordreFixe.forEach(key => {
            const val = dataFin[key];
            const milieu = cumulY + (val / 2); 
            svg.append("text").attr("x", width + 4).attr("y", y(milieu)).attr("dy", "0.35em").style("font-size", "13px").style("font-weight", "600").style("fill", colorScale(key)).text((val / 1000000).toFixed(1) + "M");
            cumulY += val; 
        });
    }

    const ligneVerticale = svg.append("line").style("display", "none").attr("stroke", "#64748b").attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("y1", 0).attr("y2", height);
    svg.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
        .on("mouseover", () => ligneVerticale.style("display", null)).on("mouseout", () => { ligneVerticale.style("display", "none"); cacherInfobulle(); })
        .on("mousemove", function(event) {
            const point = dataAgeHist.find(d => d.annee === Math.round(x.invert(d3.pointer(event, this)[0])));
            if (point) {
                ligneVerticale.attr("x1", x(point.annee)).attr("x2", x(point.annee));
                const tooltip = d3.select("#tooltip");
                tooltip.html("").append("div").attr("class", "tooltip-titre").text("Année " + point.annee);
                [...ordreFixe].reverse().forEach(k => {
                    tooltip.append("div").style("color", colorScale(k)).style("font-weight", "bold").style("font-size", "11px").text(`${k} : ${(point[k] / 1000000).toFixed(2)} M (${((point[k] / point.total) * 100).toFixed(1)}%)`);
                });
                tooltip.append("div").style("color", "#475569").style("margin-top", "4px").style("border-top", "1px solid #e2e8f0").style("padding-top", "4px").text(`Total : ${(point.total / 1000000).toFixed(2)} M`);
                tooltip.classed("visible", true); deplacerInfobulle(event);
            }
        });
}

function dessinerLineBienEtre(targetId, selection) {
    const conteneur = d3.select(targetId);
    conteneur.html(""); 
    //d3.select(".card-finance").style("background-color", "#f8fafc", "important");
    const nomPays = (selection === "Global") ? "Global (Europe)" : selection;
    
    let anneesSet = new Set();
    if (santeParPaysEtAnnee[nomPays]) Object.keys(santeParPaysEtAnnee[nomPays]).forEach(a => anneesSet.add(Number(a)));
    if (satisfactionParPaysEtAnnee[nomPays]) Object.keys(satisfactionParPaysEtAnnee[nomPays]).forEach(a => anneesSet.add(Number(a)));
    const toutesLesAnnees = Array.from(anneesSet).sort((a, b) => a - b);
    
    if (toutesLesAnnees.length === 0) {
        conteneur.html("<div style='display:flex; justify-content:center; align-items:center; width:100%; height:100%; font-size: 11px; color: #94a3b8; font-style: italic;'>Données N/D</div>");
        return;
    }

    const dataSante = toutesLesAnnees.map(a => ({ annee: a, valeur: santeParPaysEtAnnee[nomPays]?.[a] || 0 })).filter(d => d.valeur > 0);
    const dataSat = toutesLesAnnees.map(a => ({ annee: a, valeur: satisfactionParPaysEtAnnee[nomPays]?.[a] || 0 })).filter(d => d.valeur > 0);

    let moySante = [], moySat = [];
    toutesLesAnnees.forEach(annee => {
        let sumS=0, cntS=0, sumSat=0, cntSat=0;
        Object.keys(santeParPaysEtAnnee).forEach(p => { if (p !== "Global (Europe)" && santeParPaysEtAnnee[p][annee] > 0) { sumS += santeParPaysEtAnnee[p][annee]; cntS++; } });
        Object.keys(satisfactionParPaysEtAnnee).forEach(p => { if (p !== "Global (Europe)" && satisfactionParPaysEtAnnee[p][annee] > 0) { sumSat += satisfactionParPaysEtAnnee[p][annee]; cntSat++; } });
        if (cntS > 0) moySante.push({annee: annee, valeur: sumS/cntS});
        if (cntSat > 0) moySat.push({annee: annee, valeur: sumSat/cntSat});
    });

    //conteneur.style("display", "block"); 
    const margin = {top: 15, right: 35, bottom: 20, left: 35}; 
    const width = 350 - margin.left - margin.right; 
    const height = 120 - margin.top - margin.bottom; 

    const svg = conteneur.append("svg").attr("width", "100%").attr("height", "100%")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(toutesLesAnnees)).range([0, width]);
    //const yMax = d3.max([...dataSante, ...dataSat, ...moySante, ...moySat], d => d.valeur) || 100;
    //const y = d3.scaleLinear().domain([0, Math.min(105, yMax * 1.05)]).range([height, 0]);
    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);
    
    svg.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d => d.toFixed(0) + "%"))
       .call(g => g.select(".domain").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5))
       .call(g => g.selectAll(".tick line").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5)).selectAll("text").style("font-size", "9px").style("fill", "#94a3b8");

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickValues(d3.extent(toutesLesAnnees)).tickFormat(d3.format("d")))
       .call(g => g.select(".domain").attr("stroke", "#cbd5e1").attr("stroke-width", 0.5)).selectAll("text").style("font-size", "9px").style("fill", "#94a3b8");

    const lineGen = d3.line().x(d => x(d.annee)).y(d => y(d.valeur)).curve(d3.curveMonotoneX);
    const couleurSante = "#15803d"; 
    const couleurSat = "#84cc16";   

    if (moySante.length > 0) svg.append("path").datum(moySante).attr("fill", "none").attr("stroke", couleurSante).attr("stroke-width", 1).style("stroke-dasharray", "3,3").style("opacity", 0.5).attr("d", lineGen);
    if (moySat.length > 0) svg.append("path").datum(moySat).attr("fill", "none").attr("stroke", couleurSat).attr("stroke-width", 1).style("stroke-dasharray", "3,3").style("opacity", 0.5).attr("d", lineGen);

    if (dataSante.length > 0) {
        svg.append("path").datum(dataSante).attr("fill", "none").attr("stroke", couleurSante).attr("stroke-width", 2).attr("d", lineGen);
        const last = dataSante[dataSante.length - 1];
        svg.append("text").attr("x", x(last.annee)+5).attr("y", y(last.valeur)).attr("dy", "0.35em").style("font-size", "9px").style("font-weight", "600").style("fill", couleurSante).text(last.valeur.toFixed(0) + "%");
    }
    if (dataSat.length > 0) {
        svg.append("path").datum(dataSat).attr("fill", "none").attr("stroke", couleurSat).attr("stroke-width", 2).attr("d", lineGen);
        const last = dataSat[dataSat.length - 1];
        svg.append("text").attr("x", x(last.annee)+5).attr("y", y(last.valeur)).attr("dy", "0.35em").style("font-size", "9px").style("font-weight", "600").style("fill", couleurSat).text(last.valeur.toFixed(0) + "%");
    }

    const focusSante = svg.append("circle").style("display", "none").attr("r", 3.5).attr("fill", couleurSante).attr("stroke", "#fff");
    const focusSat = svg.append("circle").style("display", "none").attr("r", 3.5).attr("fill", couleurSat).attr("stroke", "#fff");

    svg.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
        .on("mouseover", () => { focusSante.style("display", null); focusSat.style("display", null); })
        .on("mouseout", () => { focusSante.style("display", "none"); focusSat.style("display", "none"); cacherInfobulle(); })
        .on("mousemove", function(event) {
            const x0 = x.invert(d3.pointer(event, this)[0]);
            const anneeProche = Math.round(x0);
            const ptSante = dataSante.find(d => d.annee === anneeProche);
            const ptSat = dataSat.find(d => d.annee === anneeProche);

            if (!ptSante && !ptSat) return;
            if (ptSante) focusSante.attr("cx", x(ptSante.annee)).attr("cy", y(ptSante.valeur));
            if (ptSat) focusSat.attr("cx", x(ptSat.annee)).attr("cy", y(ptSat.valeur));

            const tooltip = d3.select("#tooltip");
            tooltip.html("").append("div").attr("class", "tooltip-titre").text("Année " + anneeProche);
            if (ptSante) tooltip.append("div").style("color", couleurSante).style("font-weight", "bold").style("font-size", "11px").text("Bonne santé : " + ptSante.valeur.toFixed(1) + " %");
            if (ptSat) tooltip.append("div").style("color", couleurSat).style("font-weight", "bold").style("font-size", "11px").text("Satisfaction : " + ptSat.valeur.toFixed(1) + " %");
            tooltip.classed("visible", true); deplacerInfobulle(event);
        });
}

// ==========================================
// --- CARTE ISOLÉE (EUROPE GLOBALE)      ---
// ==========================================
let svgEuropeCache = null;

function dessinerPaysIsole(targetId, selection) {
    const conteneur = d3.select(targetId);

    const drawMap = (xml) => {
        conteneur.html(""); 
        const svgNode = xml.documentElement.cloneNode(true);
        conteneur.node().appendChild(svgNode);
        const svg = conteneur.select("svg");
        
        svg.attr("width", "100%")
           .attr("height", "100%")
           .style("max-height", "100%")
           .style("max-width", "100%");

        
        svg.selectAll("path")
           .style("fill", "#e2e8f0")
           .style("stroke", "#ffffff")
           .style("stroke-width", "0.5px")
           .style("transition", "fill 0.3s ease")
           .style("cursor", "pointer");

        
        svg.selectAll("path").each(function() {
            const path = d3.select(this);
            const nomPaysAttr = path.attr("pays");

            // Si c'est un pays valide
            if (nomPaysAttr) {
                
                // --- 1. COULEUR AU CHARGEMENT ---
                if (nomPaysAttr === selection) {
                    path.style("fill", "#6383b8"); 
                    this.parentNode.appendChild(this); 
                } else if (selection === "Global") {
                    path.style("fill", "#cbd5e1"); 
                }

                // --- 2. INTERACTIVITÉ (Hover + Clic) ---
                path.on("mouseover", function(event) {
                    
                    if (nomPaysAttr !== selection) {
                        d3.select(this).style("fill", "#94a3b8");
                    }
                    
                    
                    const tooltip = d3.select("#tooltip");
                    tooltip.html("").append("div").attr("class", "tooltip-titre").text(nomPaysAttr);
                    tooltip.classed("visible", true);
                })
                .on("mousemove", function(event) { 
                    deplacerInfobulle(event); 
                })
                .on("mouseout", function() {
                    cacherInfobulle();
                    
                    if (nomPaysAttr === selection) {
                        d3.select(this).style("fill", "#6383b8"); 
                    } else if (selection === "Global") {
                        d3.select(this).style("fill", "#cbd5e1");
                    } else {
                        d3.select(this).style("fill", "#e2e8f0");
                    }
                })
                .on("click", function() {
                    cacherInfobulle(); 
                    
                    
                    d3.select("#filtre-pays").property("value", nomPaysAttr);
                    
                    
                    mettreAJourDashboard(nomPaysAttr);
                });
            }
        });
    };

    if (!svgEuropeCache) {
        d3.xml("https://raw.githubusercontent.com/bricerenouf/hackaviz2026/refs/heads/main/data/UE_svg_blank_meta.svg")
          .then(xml => { svgEuropeCache = xml; drawMap(xml); })
          .catch(err => console.error("Erreur SVG UE :", err));
    } else {
        drawMap(svgEuropeCache);
    }
}

// ==========================================
// --- SUNBURST CHART : DÉPENSES          ---
// ==========================================
function dessinerSunburst(targetId, selection, dataBrutes) {
    const conteneur = d3.select(targetId);
    conteneur.html(""); 

    if (selection === "Global" || !dataBrutes) {
        conteneur.html("<div style='text-align:center; color:#94a3b8; font-size:11px; margin-top:40px;'>Sélectionnez un pays<br>pour voir la répartition</div>");
        return;
    }

    const dataPays = dataBrutes.filter(d => d.pays === selection && d.total && d.total.toLowerCase() === "sous-total" && d.annee == 2023);

    if (dataPays.length === 0) {
        conteneur.html("<div style='text-align:center; color:#94a3b8; font-size:11px; margin-top:40px;'>Aucune donnée de dépense</div>");
        return;
    }

    const hierarchyData = { name: "Total", children: [] };
    const groupes = {};

    dataPays.forEach(d => {
        const cat = d.depense_cat_courte || "Autre";
        const sousCat = d.depense_courte || "Inconnu";
        const val = nettoyerMontant(d.montant); 
        
        if (val > 0) {
            if (!groupes[cat]) groupes[cat] = [];
            groupes[cat].push({ name: sousCat, value: val });
        }
    });

    for (let categorie in groupes) hierarchyData.children.push({ name: categorie, children: groupes[categorie] });

    const width = 320; 
    const radius = width / 2;

    const svg = conteneur.append("svg").attr("width", width).attr("height", width).style("overflow", "visible")
        .append("g").attr("transform", `translate(${width / 2},${width / 2})`);

    const root = d3.hierarchy(hierarchyData).sum(d => d.value);
    d3.partition().size([2 * Math.PI, radius])(root);

    const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1).innerRadius(d => d.y0).outerRadius(d => d.y1);
    const color = d3.scaleOrdinal(["#0CBBCC", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5", "#bc80bd", "#ccebc5"]);

    svg.selectAll("path").data(root.descendants().filter(d => d.depth > 0)).enter().append("path")
        .attr("d", arc).style("fill", d => color((d.children ? d : d.parent).data.name)).style("stroke", "#ffffff").style("stroke-width", "1px")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.7);
            const tooltip = d3.select("#tooltip");
            tooltip.html("").append("div").attr("class", "tooltip-titre").text(d.data.name);
            tooltip.append("div").attr("class", "tooltip-valeur").text(d.value.toLocaleString("fr-FR") + " M€");
            tooltip.classed("visible", true);
        })
        .on("mousemove", function(event) { deplacerInfobulle(event); })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); cacherInfobulle(); });

    svg.selectAll("text.label-sunburst").data(root.descendants().filter(d => d.depth === 1)).enter().append("text")
        .attr("class", "label-sunburst").attr("transform", function(d) { return `translate(${arc.centroid(d)})`; }).attr("dy", "0.35em")
        .attr("text-anchor", "middle").style("font-size", "10px").style("font-weight", "600").style("fill", "#334155").style("pointer-events", "none") 
        .text(d => {
            if (d.x1 - d.x0 < 0.25) return ""; 
            return d.data.name.length > 12 ? d.data.name.substring(0, 12) + "..." : d.data.name;
        });
}

// ==========================================
// --- GESTION DE LA GRAMMAIRE DES PAYS   ---
// ==========================================
function obtenirArticle(pays) {
    const articles = {
        "Allemagne": "l'", "Autriche": "l'", "Espagne": "l'", "Estonie": "l'", "Irlande": "l'", "Italie": "l'",
        "Pays-Bas": "les ", "Danemark": "le ", "Luxembourg": "le ", "Portugal": "le ", "Chypre": "", "Malte": ""
    };
    return articles[pays] !== undefined ? articles[pays] : "la ";
}


// ==========================================
// --- TEXTE DYNAMIQUE (ANALYSE ENSEIGNEMENT)
// ==========================================
function mettreAJourTexteDynamique(selection) {
    const texteContainer = d3.select("#texte-dynamique-droite");

    if (selection === "Global" || !selection) {
        texteContainer.html("Sélectionnez un pays pour explorer son profil éducatif.<br><br>Cette analyse dynamique croise les tendances démographiques, l'évolution budgétaire sur 10 ans et la trajectoire réelle des compétences scolaires (PISA).");
        return;
    }

    try {
        // --- 1. EXTRACTION DÉMOGRAPHIQUE ---
        const pop2023 = (populationParPays[selection] && populationParPays[selection][2023]) ? populationParPays[selection][2023].total : null;
        const pop2013 = (populationParPays[selection] && populationParPays[selection][2013]) ? populationParPays[selection][2013].total : null;
        
        let tendancePop = "stable";
        let evolutionPopDetail = "";
        
        if (pop2023 && pop2013) {
            const evolution = ((pop2023 - pop2013) / pop2013) * 100;
            if (evolution > 2) {
                tendancePop = "hausse";
                evolutionPopDetail = `en croissance démographique (+${Math.abs(evolution).toFixed(1)}% sur la dernière décennie)`;
            } else if (evolution < -2) {
                tendancePop = "baisse";
                evolutionPopDetail = `en transition démographique (-${Math.abs(evolution).toFixed(1)}% sur 10 ans)`;
            } else {
                evolutionPopDetail = `avec une population remarquablement stable depuis dix ans`;
            }
        }

        // --- 2. EXTRACTION BUDGÉTAIRE ET ÉVOLUTION ---
        const budgetEns = (categoriesParPays[selection] && categoriesParPays[selection][2023]) ? categoriesParPays[selection][2023]["Enseignement"] || 0 : 0;
        const budget2013 = (categoriesParPays[selection] && categoriesParPays[selection][2013]) ? categoriesParPays[selection][2013]["Enseignement"] || 0 : 0;
        //const depHabitant = (budgetEns > 0 && pop2023 > 0) ? ((budgetEns * 1000000) / pop2023).toFixed(0) : "N/D";
        const depHabitant = (budgetEns > 0 && pop2023 > 0) ? ((budgetEns * 1000000) / pop2023).toLocaleString("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "N/D";

        let tendanceBudget = "inconnu";
        let detailTendanceBudget = "";
        
        if (budgetEns > 0 && budget2013 > 0) {
            const evoBudget = ((budgetEns - budget2013) / budget2013) * 100;
            if (evoBudget > 5) {
                tendanceBudget = "hausse";
                detailTendanceBudget = `(en hausse de ${evoBudget.toFixed(0)}% sur 10 ans)`;
            } else if (evoBudget < -5) {
                tendanceBudget = "baisse";
                detailTendanceBudget = `(en baisse de ${Math.abs(evoBudget).toFixed(0)}% depuis 10 ans)`;
            } else {
                tendanceBudget = "stable";
                detailTendanceBudget = `(maintenu relativement stable depuis 10 ans)`;
            }
        }

        // --- 3. EXTRACTION PISA 2022 ET ÉVOLUTION DEPUIS 2012 ---
        const pisaData = (competencesParPaysEtAnnee[selection] && competencesParPaysEtAnnee[selection][2022]) ? competencesParPaysEtAnnee[selection][2022] : null;
        let scoreMoyen = 0, nbScores = 0;
        let scoreMaths = "N/D", scoreLecture = "N/D", scoreSciences = "N/D";
        
        if (pisaData) {
            if (pisaData.maths) { scoreMoyen += pisaData.maths; nbScores++; scoreMaths = pisaData.maths.toFixed(0); }
            if (pisaData.lecture) { scoreMoyen += pisaData.lecture; nbScores++; scoreLecture = pisaData.lecture.toFixed(0); }
            if (pisaData.sciences) { scoreMoyen += pisaData.sciences; nbScores++; scoreSciences = pisaData.sciences.toFixed(0); }
        }
        let moyennePisa = nbScores > 0 ? (scoreMoyen / nbScores).toFixed(0) : "N/D";

        // Calcul du score PISA de 2012 pour la comparaison
        const pisa2012 = (competencesParPaysEtAnnee[selection] && competencesParPaysEtAnnee[selection][2012]) ? competencesParPaysEtAnnee[selection][2012] : null;
        let scoreMoyen2012 = 0, nbScores2012 = 0;
        if (pisa2012) {
            if (pisa2012.maths) { scoreMoyen2012 += pisa2012.maths; nbScores2012++; }
            if (pisa2012.lecture) { scoreMoyen2012 += pisa2012.lecture; nbScores2012++; }
            if (pisa2012.sciences) { scoreMoyen2012 += pisa2012.sciences; nbScores2012++; }
        }
        let moyennePisa2012 = nbScores2012 > 0 ? (scoreMoyen2012 / nbScores2012).toFixed(0) : "N/D";

        // Création de la phrase chiffrée sur l'évolution des compétences
        let texteDynamiqueEvo = "";
        if (moyennePisa !== "N/D" && moyennePisa2012 !== "N/D") {
            const diff = moyennePisa - moyennePisa2012;
            if (diff >= 3) texteDynamiqueEvo = `Fait très positif : on note une réelle montée en puissance des compétences avec <b>une progression de +${diff} points depuis 10 ans</b>. `;
            else if (diff <= -3) texteDynamiqueEvo = `Plus inquiétant : la tendance est à la baisse, avec <b>une perte de ${Math.abs(diff)} points de niveau moyen depuis 10 ans</b>. `;
            else texteDynamiqueEvo = `Le niveau des élèves est par ailleurs <b>resté parfaitement stable sur la dernière décennie</b>. `;
        }
        
        let qualificatifPisa = "";
        let couleurPisa = "";
        let analyseImpact = "";
        let syntheseGlobale = "";

        // --- 4. VARIABLES D'ANALYSE CROISÉE ---
        if (moyennePisa !== "N/D") {
            // ============ SCORES EXCELLENTS ============
            if (moyennePisa >= 500) {
                qualificatifPisa = "parmi les meilleurs élèves d'Europe";
                couleurPisa = "#0CBBCC"; 
                if (tendanceBudget === "hausse") {
                    analyseImpact = `Ici, le système éducatif tourne à plein régime. L'augmentation du budget ${detailTendanceBudget} s'est transformée directement en excellents résultats. ${texteDynamiqueEvo}Les jeunes sortent de l'école très bien armés pour innover et tirer l'économie du pays vers le haut.`;
                    syntheseGlobale = "Bilan : on a affaire à un modèle gagnant où les fonds supplémentaires sont parfaitement rentabilisés par la réussite des élèves.";
                } else if (tendanceBudget === "baisse") {
                    analyseImpact = `Même avec un budget ${detailTendanceBudget}, le système maintient d'excellents résultats ! ${texteDynamiqueEvo}C'est la preuve d'une organisation ultra-efficace où les jeunes sortent de l'école prêts à innover sur le marché du travail.`;
                    syntheseGlobale = "Bilan : c'est un modèle d'efficience absolue. Le pays fait des miracles éducatifs sans avoir besoin de gonfler indéfiniment ses dépenses.";
                } else {
                    analyseImpact = `L'argent investi ${detailTendanceBudget} se transforme en excellents résultats. ${texteDynamiqueEvo}C'est un vrai atout pour l'avenir des jeunes sur le marché du travail.`;
                    syntheseGlobale = "Bilan : un modèle d'excellence où chaque euro investi trouve sa place dans la réussite des élèves.";
                }
            
            // ============ SCORES MOYENS ============
            } else if (moyennePisa >= 475) {
                qualificatifPisa = "dans la bonne moyenne européenne";
                couleurPisa = "#f59e0b"; 
                if (tendanceBudget === "hausse") {
                    analyseImpact = `L'essentiel est assuré : la majorité des élèves maîtrise les bases. Cependant, malgré un effort financier évident ${detailTendanceBudget}, les résultats stagnent dans la moyenne. ${texteDynamiqueEvo}Le vrai défi sera de mieux utiliser cet argent pour enfin faire décoller le niveau vers l'excellence.`;
                    syntheseGlobale = "Bilan : c'est du solide, mais le pays doit s'assurer que ses futurs investissements se traduisent par une vraie montée en compétence.";
                } else if (tendanceBudget === "baisse") {
                    analyseImpact = `Le maintien d'un niveau globalement correct avec un budget resserré ${detailTendanceBudget} montre une certaine résilience. ${texteDynamiqueEvo}Mais pour se démarquer, la rigueur financière a ses limites et l'excellence demandera de nouveaux moyens.`;
                    syntheseGlobale = "Bilan : le système limite la casse avec moins d'argent, mais il en a encore sous le pied pour vraiment décoller s'il révise son financement.";
                } else {
                    analyseImpact = `L'essentiel est assuré : la grande majorité des élèves maîtrise les bases. ${texteDynamiqueEvo}Mais pour vraiment se démarquer face aux leaders, le système va devoir se réinventer, surtout dans les matières scientifiques.`;
                    syntheseGlobale = "Bilan : c'est du solide, mais le système en a encore sous le pied pour tirer le meilleur parti de ses dépenses.";
                }

            // ============ SCORES FAIBLES ============
            } else {
                qualificatifPisa = "en dessous des standards attendus";
                couleurPisa = "#ef4444"; 
                if (tendanceBudget === "hausse") {
                    analyseImpact = `Le constat pique un peu : l'État a pourtant fait un gros effort financier ${detailTendanceBudget} ! ${texteDynamiqueEvo}C'est la preuve que jeter de l'argent sur un problème ne suffit pas, c'est toute la méthode d'apprentissage qu'il faut repenser de toute urgence.`;
                    syntheseGlobale = "Bilan : un vrai signal d'alarme. L'argent a coulé, mais le niveau décroche. Il faut changer d'approche pédagogique.";
                } else if (tendanceBudget === "baisse") {
                    analyseImpact = `Le système éducatif rencontre de vraies difficultés, et la rigueur budgétaire ${detailTendanceBudget} semble se faire douloureusement ressentir. ${texteDynamiqueEvo}Le vrai risque, c'est de voir les jeunes arriver sur le marché du travail en total décalage avec les besoins.`;
                    syntheseGlobale = "Bilan : l'alerte est lancée. Pour enrayer la chute du niveau, il va falloir relancer l'investissement et oser de nouvelles approches.";
                } else {
                    analyseImpact = `Ces chiffres montrent que le système éducatif rencontre de vraies difficultés. ${texteDynamiqueEvo}Injecter du budget ne fait pas tout : il y a urgence à réformer le système pour sauver le niveau.`;
                    syntheseGlobale = "Bilan : pour faire vraiment remonter le niveau, il faudra des réformes profondes qui vont bien au-delà du simple financement.";
                }
            }
        }

        const anneesSat = satisfactionParPaysEtAnnee[selection] ? Object.keys(satisfactionParPaysEtAnnee[selection]).sort((a,b) => b-a) : [];
        const satisfaction = anneesSat.length > 0 ? satisfactionParPaysEtAnnee[selection][anneesSat[0]].toFixed(1) : "N/D";


    // --- 5. RÉDACTION DU TEXTE COMPLET ---
        
        let htmlTexte = `<div style="color: #334155; font-size: 14px; line-height: 1.6;">`;
        
        // --- BLOC 1 ---
        htmlTexte += `<div style="margin-bottom: 45px;">`;
        htmlTexte += `<b>Pression démographique et stratégie budgétaire</b><br>`;
        if (budgetEns > 0 && pop2023 > 0) {
            const popMillions = (pop2023 / 1000000).toFixed(1);
            
            
            const article = obtenirArticle(selection);
            const verbe = (selection === "Pays-Bas") ? "abritent" : "abrite";
            
            htmlTexte += `En 2023, ${article}<b>${selection}</b> ${verbe} une population de ${popMillions} millions d'habitants, s'inscrivant dans un pays <b>${evolutionPopDetail}</b>. `;
            if (tendancePop === "hausse") htmlTexte += `Pour absorber l'afflux constant de nouveaux élèves, `;
            else if (tendancePop === "baisse") htmlTexte += `Malgré un vivier étudiant qui tend à se réduire, `;
            else htmlTexte += `Pour maintenir ses infrastructures de façon stable, `;

            htmlTexte += `le gouvernement a alloué un budget global de <b>${budgetEns.toLocaleString("fr-FR")} M€</b> au secteur de l'Enseignement. Cet engagement majeur représente un effort direct de <b style="color:#0CBBCC;">${depHabitant} € par habitant</b>.`;
        } else {
            htmlTexte += `Les données consolidées manquent pour analyser avec précision l'effort financier par habitant en 2023.`;
        }
        htmlTexte += `</div>`;

        // --- BLOC 2 ---
        htmlTexte += `<div style="margin-bottom: 45px;">`;
        htmlTexte += `<b>Efficacité : Le verdict des évaluations internationales</b><br>`;
        if (moyennePisa !== "N/D") {
            htmlTexte += `Comment l'effort financier se matérialise-t-il sur les bancs de l'école ? Lors de la dernière évaluation, les élèves du pays ont obtenu une moyenne globale de <b>${moyennePisa} points</b>. En observant le détail (<b>${scoreMaths}</b> en maths, <b>${scoreLecture}</b> en lecture et <b>${scoreSciences}</b> en sciences), le système se positionne <b style="color:${couleurPisa};">${qualificatifPisa}</b>. <br><br>${analyseImpact} `;
        } else {
            htmlTexte += `La base de données actuelle ne dispose pas des derniers résultats scolaires pour ce pays. Il est donc difficile de mesurer la rentabilité immédiate des investissements mis en place. `;
        }
        htmlTexte += `</div>`;

        // --- BLOC 3 ---
        htmlTexte += `<div>`;
        htmlTexte += `<b>Écosystème social et conclusion</b><br>`;
        if (satisfaction !== "N/D") {
            htmlTexte += `Bien sûr, l'école ne fait pas tout : le cadre de vie joue un rôle énorme. Avec une qualité de vie estimée à "bonne" par <b>${satisfaction}%</b> de ses habitants en 2024, le pays `;
            
            if (satisfaction >= 7.5) {
                htmlTexte += `offre un environnement très serein. C'est un avantage énorme pour les élèves : grandir dans un climat rassurant permet d'étudier avec l'esprit libre et facilite grandement la réussite. `;
            } else if (satisfaction >= 6.5) {
                htmlTexte += `offre un cadre de vie plutôt stable et agréable. Même si tout n'est pas parfait, le contexte reste tout à fait correct pour permettre aux jeunes de suivre leur scolarité sereinement. `;
            } else {
                htmlTexte += `fait face à un climat social plus compliqué. Et ça compte beaucoup : un quotidien difficile ou stressant finit toujours par franchir les portes de l'école et pèse sur la concentration des élèves, même avec le meilleur budget du monde. `;
            }
        } else {
            htmlTexte += `Difficile d'en dire plus sur le climat social, car nous n'avons pas d'indicateur récent sur le bien-être de la population. `;
        }
        
        if (syntheseGlobale) {
            htmlTexte += `<div style="margin-top: 15px;"><i style="color: #334155;">${syntheseGlobale}</i></div>`;
        }
        htmlTexte += `</div>`;

        htmlTexte += `</div>`; 

        texteContainer.html(htmlTexte);

    } catch(e) {
        console.error("Erreur génération texte dynamique:", e);
        texteContainer.html("Une erreur est survenue lors de la génération de l'analyse détaillée.");
    }
}

// ==========================================
// --- GRAPHIQUE COMPÉTENCES VS BUDGET    ---
// ==========================================
function dessinerGraphiqueCompetences(selection) {
    try {
        const conteneur = d3.select("#competences-chart-container");
        if (conteneur.empty()) return; 
        conteneur.html(""); 

        if (selection === "Global" || !competencesParPaysEtAnnee[selection]) {
            conteneur.html("<div style='display:flex; justify-content:center; align-items:center; height:100%; color:#94a3b8; font-size:12px; font-style:italic;'>Données N/D</div>");
            return;
        }

        const anneesPisa = [2006, 2009, 2012, 2015, 2018, 2022];
        let data = [];
        let allScores = [];

        anneesPisa.forEach(a => {
            const comp = competencesParPaysEtAnnee[selection][a] || {};
            // Récupère le montant global en millions d'euros
            const depEnsM = (categoriesParPays[selection] && categoriesParPays[selection][a]) ? categoriesParPays[selection][a]["Enseignement"] || 0 : 0;

            if (comp.maths) allScores.push(comp.maths);
            if (comp.lecture) allScores.push(comp.lecture);
            if (comp.sciences) allScores.push(comp.sciences);

            data.push({
                annee: a,
                maths: comp.maths || null,
                lecture: comp.lecture || null,
                sciences: comp.sciences || null,
                depenses: depEnsM 
            });
        });

        const node = conteneur.node();
        if(!node) return;
        
        const margin = {top: 10, right: 45, bottom: 25, left: 35};
        const width = node.getBoundingClientRect().width - margin.left - margin.right;
        const height = 220 - margin.top - margin.bottom;

        
        if(width <= 0) return; 

        const svg = conteneur.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

       
        const x = d3.scaleLinear().domain([2006, 2022]).range([0, width]);
        
        const minScore = allScores.length > 0 ? d3.min(allScores) : 380;
        const maxScore = allScores.length > 0 ? d3.max(allScores) : 560;
        const yScores = d3.scaleLinear().domain([minScore * 0.95, maxScore * 1.05]).range([height, 0]);
        
        const maxBudget = d3.max(data, d => d.depenses) || 1000; 
        const yBudget = d3.scaleLinear().domain([0, maxBudget * 1.2]).range([height, 0]);

        const areaBudget = d3.area()
            .x(d => x(d.annee))
            .y0(height)
            .y1(d => yBudget(d.depenses))
            .curve(d3.curveMonotoneX);

        svg.append("path").datum(data).attr("fill", "#e2e8f0").attr("opacity", 0.6).attr("d", areaBudget);

        const drawLine = (key, color) => {
            const dataFiltree = data.filter(d => d[key] !== null);
            if (dataFiltree.length === 0) return;
            const line = d3.line().x(d => x(d.annee)).y(d => yScores(d[key])).curve(d3.curveMonotoneX);
            svg.append("path").datum(dataFiltree).attr("fill", "none").attr("stroke", color).attr("stroke-width", 2).attr("d", line);
            svg.selectAll(".dot-" + key).data(dataFiltree).enter().append("circle")
                .attr("cx", d => x(d.annee)).attr("cy", d => yScores(d[key])).attr("r", 3).attr("fill", color).attr("stroke", "#ffffff").attr("stroke-width", 1);
        };

        drawLine("maths", "#0CBBCC");
        drawLine("lecture", "#f59e0b");
        drawLine("sciences", "#8b5cf6");

        svg.append("g").attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickValues([2006, 2022]).tickFormat(d3.format("d")))
            .selectAll("text").style("fill", "#64748b").style("font-size", "10px");

        svg.append("g").call(d3.axisLeft(yScores).ticks(4))
            .call(g => g.select(".domain").attr("stroke", "#cbd5e1")).selectAll("text").style("fill", "#64748b").style("font-size", "9px");

        svg.append("g").attr("transform", `translate(${width}, 0)`)
            .call(d3.axisRight(yBudget).ticks(4).tickFormat(d => d.toLocaleString("fr-FR", {maximumFractionDigits: 0}) + " M€"))
            .call(g => g.select(".domain").attr("stroke", "transparent")).selectAll("text").style("fill", "#94a3b8").style("font-size", "9px");

        const focusLine = svg.append("line").style("display", "none").attr("stroke", "#94a3b8").attr("stroke-width", 1).attr("stroke-dasharray", "3,3").attr("y1", 0).attr("y2", height);

        svg.append("rect").attr("width", width).attr("height", height).style("fill", "none").style("pointer-events", "all")
            .on("mouseover", () => focusLine.style("display", null))
            .on("mouseout", () => { focusLine.style("display", "none"); cacherInfobulle(); })
            .on("mousemove", function(event) {
                const x0 = x.invert(d3.pointer(event, this)[0]);
                const anneeProche = anneesPisa.reduce((prev, curr) => Math.abs(curr - x0) < Math.abs(prev - x0) ? curr : prev);
                const pt = data.find(d => d.annee === anneeProche);

                if (pt) {
                    focusLine.attr("x1", x(pt.annee)).attr("x2", x(pt.annee));
                    
                    const tooltip = d3.select("#tooltip");
                    tooltip.html("");
                    tooltip.append("div").attr("class", "tooltip-titre").text(selection + " en " + pt.annee);
                    tooltip.append("div").style("color", "#64748b").style("font-size", "11px").style("margin-bottom", "5px")
                        .text(`Dépenses : ${pt.depenses > 0 ? pt.depenses.toLocaleString("fr-FR", {maximumFractionDigits: 0}) + " M€" : "N/D"}`);
                    
                    if(pt.maths) tooltip.append("div").style("color", "#0CBBCC").style("font-size", "11px").style("font-weight", "bold").text(`Mathématiques : ${pt.maths.toFixed(1)}`);
                    if(pt.lecture) tooltip.append("div").style("color", "#f59e0b").style("font-size", "11px").style("font-weight", "bold").text(`Lecture : ${pt.lecture.toFixed(1)}`);
                    if(pt.sciences) tooltip.append("div").style("color", "#8b5cf6").style("font-size", "11px").style("font-weight", "bold").text(`Sciences : ${pt.sciences.toFixed(1)}`);
                    tooltip.classed("visible", true); deplacerInfobulle(event);
                }
            });
    } catch(e) {
        console.error("Erreur sur le graph Compétences:", e);
    }
}


// ==========================================
// --- PAGE 3 : BUBBLE CHART & CLUSTERING ---
// ==========================================

const modelesEco = {
    "Allemagne": "Continental", "Autriche": "Continental", "France": "Continental", "Belgique": "Continental", "Pays-Bas": "Continental", "Luxembourg": "Continental",
    "Danemark": "Nordique", "Finlande": "Nordique", "Suède": "Nordique",
    "Espagne": "Méditerranéen", "Italie": "Méditerranéen", "Portugal": "Méditerranéen", "Grèce": "Méditerranéen", "Chypre": "Méditerranéen", "Malte": "Méditerranéen",
    "Irlande": "Anglo-Saxon"
};

let simulationForce;
let modeClusterActif = false;
let dataBulles = [];
let timerAnimation = null; 


   function initPage3() {
    // 1. LE SLIDER MANUEL
    d3.select("#slider-annee").on("input", function() {
        const annee = parseInt(this.value);
        d3.select("#valeur-annee-p3").text(annee);
        dessinerBubbleLandscape(annee);
        mettreAJourTextePage3(annee); 
    });

    // 2. LE BOUTON PLAY/PAUSE
    d3.select("#btn-play-animation").on("click", function() {
        const btn = d3.select(this);
        const slider = d3.select("#slider-annee").node();
        
        if (timerAnimation) {
            // Pause
            clearInterval(timerAnimation);
            timerAnimation = null;
            btn.text("▶ Lecture").style("color", "#334155");
        } else {
            // Lecture
            btn.text("⏸ Pause").style("color", "#0CBBCC");
            
            if (parseInt(slider.value) >= parseInt(slider.max)) {
                slider.value = slider.min;
                d3.select("#valeur-annee-p3").text(slider.value);
                dessinerBubbleLandscape(parseInt(slider.value));
                mettreAJourTextePage3(parseInt(slider.value)); 
            }
            
            timerAnimation = setInterval(() => {
                let anneeActuelle = parseInt(slider.value);
                if (anneeActuelle < parseInt(slider.max)) {
                    anneeActuelle++;
                    slider.value = anneeActuelle;
                    d3.select("#valeur-annee-p3").text(anneeActuelle);
                    dessinerBubbleLandscape(anneeActuelle);
                    mettreAJourTextePage3(anneeActuelle); 
                } else {
                    clearInterval(timerAnimation);
                    timerAnimation = null;
                    btn.text("▶ Lecture").style("color", "#334155");
                }
            }, 1000); 
        }
    });

    // --- LOGIQUE DE L'INTERRUPTEUR DE VUES ---
    d3.select("#btn-vue-globale").on("click", function() {
        if (!modeClusterActif) return; 
        
        modeClusterActif = false;
        
        
        d3.select(this).classed("actif", true);
        d3.select("#btn-vue-modeles").classed("actif", false);
        
        
        dessinerBubbleLandscape(parseInt(d3.select("#slider-annee").property("value")));
    });

    d3.select("#btn-vue-modeles").on("click", function() {
        if (modeClusterActif) return; 
        
        modeClusterActif = true;
        
        
        d3.select(this).classed("actif", true);
        d3.select("#btn-vue-globale").classed("actif", false);
        
        
        dessinerBubbleLandscape(parseInt(d3.select("#slider-annee").property("value")));
    });

    
    setTimeout(() => {
        dessinerBubbleLandscape(2023);
        mettreAJourTextePage3(2023);
    }, 500); 
}

function preparerDataPage3(annee) {
    let data = [];
    const tousLesPays = Object.keys(totauxParPays).filter(p => p !== "Global (Europe)" && p.trim() !== "");

    tousLesPays.forEach(pays => {
        const depTotal = totauxParPays[pays]?.[annee] || 0;
        const pibTotal = pibParPaysEtAnnee[pays]?.[annee] || 0;
        const popTotal = populationParPays[pays]?.[annee]?.total || 0;

        if (depTotal > 0 && pibTotal > 0 && popTotal > 0) {
            
            // --- 1. LE BON CALCUL (Retour à la V1 cohérente) ---
            
            const pibHab = (pibTotal * 1000000) / popTotal; 
            
            // --- 2. LE CALCUL DES DÉPENSES ---
            let depensesPourcentPib = (depTotal / pibTotal) * 100;
            
            
            if (depensesPourcentPib < 2) {
                depensesPourcentPib = depensesPourcentPib * 1000;
            }

            let maxVal = 0;
            let catDominante = "Autre";
            if (categoriesParPays[pays] && categoriesParPays[pays][annee]) {
                for (let cat in categoriesParPays[pays][annee]) {
                    if (categoriesParPays[pays][annee][cat] > maxVal) {
                        maxVal = categoriesParPays[pays][annee][cat];
                        catDominante = cat;
                    }
                }
            }

            data.push({
                pays: pays,
                modele: modelesEco[pays] || "Europe de l'Est / Autre",
                pibHab: pibHab,
                depPib: depensesPourcentPib,
                depTotal: depTotal,
                catDom: catDominante,
                popTotal: popTotal
            });
        }
    });
    return data;
}

function dessinerBubbleLandscape(annee) {
    const conteneur = d3.select("#bubble-chart-container");
    const width = conteneur.node().getBoundingClientRect().width || 1000;
    const height = conteneur.node().getBoundingClientRect().height || 600;
    
    if (conteneur.select("svg").empty()) {
        conteneur.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .style("overflow", "visible"); 
    }
    const svg = conteneur.select("svg");
    svg.attr("viewBox", `0 0 ${width} ${height}`);
    svg.selectAll(".axes").remove(); 

    
    svg.selectAll(".titre-graph").remove();
    svg.selectAll(".legende-taille").remove(); 

    
    svg.append("text")
        .attr("class", "titre-graph")
        .attr("x", width / 2) 
        .attr("y", 25)        
        .attr("fill", "#64748b") 
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .text("Évolution & Modèles Économiques");

    
    const anciennesBulles = new Map();
    svg.selectAll(".bulle-groupe").each(function(d) {
        anciennesBulles.set(d.pays, { x: d.x, y: d.y, vx: d.vx, vy: d.vy });
    });

    dataBulles = preparerDataPage3(annee);
    if(dataBulles.length === 0) return;

    
    dataBulles.forEach(d => {
        const old = anciennesBulles.get(d.pays);
        if (old && old.x && old.y) {
            d.x = old.x;
            d.y = old.y;
            d.vx = old.vx || 0;
            d.vy = old.vy || 0;
        } else {
            
            d.x = width / 2;
            d.y = height / 2;
        }
    });

    // --- Échelles ---
    //const maxPib = d3.max(dataBulles, d => d.pibHab) || 100000;
    const maxPib = 100000;
    
    const x = d3.scaleLinear().domain([0, maxPib * 1.05]).range([110, width - 60]);
    
    
    const y = d3.scaleLinear().domain([0, 100]).range([height - 80, 50]);
    
    const r = d3.scaleSqrt().domain([0, d3.max(dataBulles, d => d.popTotal)]).range([10, 50]);
    
    const categoriesSet = Array.from(new Set(dataBulles.map(d => d.catDom)));
    const color = d3.scaleOrdinal(d3.schemeSet2).domain(categoriesSet);

    const groupeAxes = svg.append("g").attr("class", "axes").style("opacity", modeClusterActif ? 0 : 1);
    
    // --- 1. L'AXE X (Abscisses) ---
    groupeAxes.append("g").attr("transform", `translate(0,${height - 80})`)
              .call(d3.axisBottom(x).ticks(8).tickFormat(d => (d/1000).toFixed(0) + "k €"))
              .attr("color", "#94a3b8");
              
    groupeAxes.append("text").attr("x", width/2).attr("y", height - 40).attr("fill", "#64748b").style("text-anchor", "middle").style("font-size", "12px").style("font-weight", "bold").text("PIB par habitant (€)");

    // --- 2. L'AXE Y (Ordonnées) ---
    groupeAxes.append("g").attr("transform", `translate(110,0)`)
              
              .call(d3.axisLeft(y).ticks(10).tickFormat(d => d + " %"))
              .attr("color", "#94a3b8");
              
    groupeAxes.append("text").attr("transform", "rotate(-90)").attr("y", 40).attr("x", -height/2).attr("fill", "#64748b").style("text-anchor", "middle").style("font-size", "12px").style("font-weight", "bold").text("Dépenses Publiques (% du PIB)");
    let node = svg.selectAll(".bulle-groupe").data(dataBulles, d => d.pays);
    node.exit().transition().duration(500).attr("r", 0).remove();

    // ==========================================
    // --- LÉGENDE DE TAILLE (POPULATION)     ---
    // ==========================================
    const groupeLegende = svg.append("g")
        .attr("class", "legende-taille")
        
        .attr("transform", `translate(${width - 100}, 130)`)
        .style("opacity", modeClusterActif ? 0 : 1); 

    groupeLegende.append("text")
        .attr("x", 0)
        .attr("y", -110)
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "#64748b")
        .style("text-transform", "uppercase")
        .text("Population");

    
    const maxPop = d3.max(dataBulles, d => d.popTotal) || 80000000;
    const valeursLegende = [maxPop, maxPop / 2, maxPop / 10];

    valeursLegende.forEach(val => {
        const rayon = r(val);
        
        
        groupeLegende.append("circle")
            .attr("cx", 0)
            .attr("cy", -rayon)
            .attr("r", rayon)
            .style("fill", "none")
            .style("stroke", "#94a3b8")
            .style("stroke-width", "1px")
            .style("opacity", 0.6);

        
        groupeLegende.append("line")
            .attr("x1", 0)
            .attr("x2", 40)
            .attr("y1", -rayon * 2)
            .attr("y2", -rayon * 2)
            .style("stroke", "#94a3b8")
            .style("stroke-dasharray", "2,2")
            .style("opacity", 0.6);

        
        groupeLegende.append("text")
            .attr("x", 45)
            .attr("y", -rayon * 2)
            .attr("dy", "0.3em")
            .style("font-size", "10px")
            .style("fill", "#64748b")
            .text((val / 1000000).toFixed(0) + " M");
    });

    let nodeEnter = node.enter().append("g")
        .attr("class", "bulle-groupe")
        //.style("cursor", "pointer")
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    nodeEnter.append("circle")
        .attr("r", 0)
        .style("fill", d => color(d.catDom))
        .style("stroke", "#ffffff")
        .style("stroke-width", "2px")
        .style("opacity", 0.85);

    nodeEnter.append("text")
        .text(d => d.pays.substring(0, 3).toUpperCase())
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .style("fill", "#1e293b")
        .attr("dy", "3px")
        .style("pointer-events", "none");

    node = nodeEnter.merge(node);

    
    node.select("circle")
        .transition().duration(1000)
        .attr("r", d => r(d.popTotal))
        .style("fill", d => color(d.catDom));

    node.on("mouseover", function(event, d) {
        
        d3.select(this).select("circle").style("stroke", "#4b5668").style("stroke-width", "1px").style("opacity", 1);
        
        const tooltip = d3.select("#tooltip");
        tooltip.html("");
        tooltip.append("div").attr("class", "tooltip-titre").text(d.pays + " (" + annee + ")");
        tooltip.append("div").style("color", color(d.catDom)).style("font-weight", "bold").style("font-size", "11px").text("Cat. Dominante : " + d.catDom);
        tooltip.append("div").style("margin-top", "5px").style("font-size", "11px").text("Dépenses : " + d.depPib.toFixed(1) + " % du PIB");
        tooltip.append("div").style("font-size", "11px").text("PIB/hab : " + d.pibHab.toLocaleString("fr-FR", {maximumFractionDigits:0}) + " €");
        tooltip.append("div").style("font-size", "11px").style("color", "#64748b").style("margin-top", "4px").text("Modèle : " + d.modele);
        tooltip.classed("visible", true);
    })
    .on("mousemove", deplacerInfobulle)
    .on("mouseout", function() {
        
        d3.select(this).select("circle").style("stroke", "#ffffff").style("stroke-width", "2px").style("opacity", 0.85);
        cacherInfobulle();
    })
    /*.on("click", function(event, d) {
        cacherInfobulle();
        d3.select("#filtre-pays").property("value", d.pays);
        mettreAJourDashboard(d.pays);
        document.getElementById("page-2").scrollIntoView({ behavior: "smooth" });
    });*/

    if (simulationForce) simulationForce.stop(); 

    const centresClusters = {
        "Nordique": { x: width * 0.25, y: height * 0.3 },
        "Continental": { x: width * 0.75, y: height * 0.3 },
        "Méditerranéen": { x: width * 0.25, y: height * 0.7 },
        "Anglo-Saxon": { x: width * 0.75, y: height * 0.7 },
        "Europe de l'Est / Autre": { x: width * 0.5, y: height * 0.5 }
    };

    svg.selectAll(".label-cluster").remove();
    if(modeClusterActif) {
        Object.keys(centresClusters).forEach(k => {
            svg.append("text").attr("class", "label-cluster")
               .attr("x", centresClusters[k].x).attr("y", centresClusters[k].y - 80)
               .style("text-anchor", "middle").style("font-size", "24px").style("font-weight", "bold").style("fill", "#cbd5e1").style("opacity", 0.5)
               .text(k);
        });
        svg.selectAll(".label-cluster").lower();
    }

    
    simulationForce = d3.forceSimulation(dataBulles)
        .alpha(0.3) 
        .velocityDecay(0.3)
        .force("collide", d3.forceCollide().radius(d => r(d.popTotal) + 2).iterations(4));

    if (!modeClusterActif) {
        simulationForce
            .force("x", d3.forceX(d => x(d.pibHab)).strength(0.08))
            .force("y", d3.forceY(d => y(d.depPib)).strength(0.08));
    } else {
        simulationForce
            .force("x", d3.forceX(d => centresClusters[d.modele].x).strength(0.08))
            .force("y", d3.forceY(d => centresClusters[d.modele].y).strength(0.08))
            .force("charge", d3.forceManyBody().strength(-10));
    }

    simulationForce.on("tick", () => {
        node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
        if (!event.active) simulationForce.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
        d.fx = event.x; d.fy = event.y;
    }
    function dragended(event, d) {
        if (!event.active) simulationForce.alphaTarget(0);
        d.fx = null; d.fy = null;
    }
}

// ==========================================
// --- CLIGNOTEMENT ALÉATOIRE (PAGE 1)    ---
// ==========================================
function initClignotementPays() {
    setInterval(() => {
        
        const paths = d3.selectAll(".pays-container path").nodes();
        if (paths.length === 0) return;

        
        const indexAleatoire = Math.floor(Math.random() * paths.length);
        const pathChoisi = d3.select(paths[indexAleatoire]);

        
        const couleurNormale = pathChoisi.attr("data-color") || couleurVide;

        
        pathChoisi
            .transition()
            .duration(400) 
            .ease(d3.easeSinInOut) 
            .attr("fill", "#0CBBCC") 
            .transition()
            .duration(600) 
            .ease(d3.easeSinInOut)
            .attr("fill", couleurNormale); 

    }, 5000); 
}

// ==========================================
// --- TEXTE DYNAMIQUE (PAGE 3 - VUE MACRO)
// ==========================================
function mettreAJourTextePage3(annee) {
    const texteContainer = d3.select("#texte-dynamique-page3");
    if (texteContainer.empty()) return;

    try {
        let totalPib = 0;
        let totalPop = 0;
        let paysValides = [];

        Object.keys(pibParPaysEtAnnee).forEach(pays => {
            if (pays === "Global (Europe)") return;

            const pibM = pibParPaysEtAnnee[pays] && pibParPaysEtAnnee[pays][annee] ? pibParPaysEtAnnee[pays][annee] : 0; 
            const pop = populationParPays[pays] && populationParPays[pays][annee] ? populationParPays[pays][annee].total : 0;
            const depM = totauxParPays[pays] && totauxParPays[pays][annee] ? totauxParPays[pays][annee] : 0; 

            if (pibM > 0 && pop > 0 && depM > 0) {
                const pibHabitant = (pibM * 1000000) / pop;
                let depHabitant = (depM * 1000000) / pop;
                
                
                let ratioDepense = (depM / pibM) * 100;
                if (ratioDepense < 2) {
                    ratioDepense = ratioDepense * 1000;
                    depHabitant = depHabitant * 1000; 
                }

                paysValides.push({ pays, pibHabitant, depHabitant, pibM, pop, ratioDepense });
                
                totalPib += pibM;
                totalPop += pop;
            }
        });

        if (paysValides.length === 0) {
            texteContainer.html("<div style='color: #334155; font-size: 14px;'>Données insuffisantes pour cette année.</div>");
            return;
        }

        // --- CALCULS STATISTIQUES ---
        paysValides.sort((a, b) => b.pibHabitant - a.pibHabitant);
        const paysLePlusRiche = paysValides[0];
        const paysLeMoinsRiche = paysValides[paysValides.length - 1];
        
        const pibMoyenHab = d3.mean(paysValides, d => d.pibHabitant);
        const depMoyenneHab = d3.mean(paysValides, d => d.depHabitant);
        
        
        const ratioDepenseMoyen = d3.mean(paysValides, d => d.ratioDepense);

        
        const paysTriesParRatio = [...paysValides].sort((a, b) => b.ratioDepense - a.ratioDepense);
        const paysMaxRatio = paysTriesParRatio[0];
        const paysMinRatio = paysTriesParRatio[paysTriesParRatio.length - 1];

        // --- NOUVEAU : PETITS HELPERS GRAMMATICAUX ---
        const formatSujet = (p) => {
            const art = obtenirArticle(p);
            return (art.charAt(0).toUpperCase() + art.slice(1)) + p; // Ex: "La France", "L'Allemagne"
        };
        
        const formatDe = (p) => {
            const art = obtenirArticle(p);
            if (art === "le ") return "du " + p;
            if (art === "les ") return "des " + p;
            if (art === "l'") return "de l'" + p;
            if (art === "la ") return "de la " + p;
            if (art === "") return "de " + p; 
            return "de la " + p; 
        };

        // --- RÉDACTION DU TEXTE ---
        let htmlTexte = `<div style="color: #334155; font-size: 14px; line-height: 1.6; display: flex; flex-direction: column; height: 100%; min-height: 100%;">`;

        // --- BLOC DE TEXTE PRINCIPAL ---
        htmlTexte += `<div>`;

        // Paragraphe 1 : Vue Globale 
        htmlTexte += `<div style="margin-bottom: 45px;">`;
        htmlTexte += `<b>Vue globale de l'économie européenne en ${annee}</b><br>`;
        htmlTexte += `En <b>${annee}</b>, le graphique à bulles met en lumière les disparités vertigineuses qui traversent l'Europe. Pour une population analysée de <b>${(totalPop / 1000000).toFixed(0)} millions d'habitants</b>, la moyenne européenne se situe autour de <b>${pibMoyenHab.toLocaleString("fr-FR", {maximumFractionDigits:0})} €</b> de richesse produite (PIB) par personne, dont environ <b style="color:#0CBBCC;">${ratioDepenseMoyen.toFixed(1)}%</b> (soit <b>${depMoyenneHab.toLocaleString("fr-FR", {maximumFractionDigits:0})} €</b>) sont absorbés par la dépense publique de l'État. L'écart est frappant : un habitant <b>${formatDe(paysLePlusRiche.pays)}</b> évolue dans une économie générant <b>${paysLePlusRiche.pibHabitant.toLocaleString("fr-FR", {maximumFractionDigits:0})} €</b>, tandis qu'à l'autre extrême du continent, le PIB moyen <b>${formatDe(paysLeMoinsRiche.pays)}</b> se situe à seulement <b>${paysLeMoinsRiche.pibHabitant.toLocaleString("fr-FR", {maximumFractionDigits:0})} €</b> par habitant.`;
        htmlTexte += `</div>`;

        // Paragraphe 2 : Modèles économiques 
        htmlTexte += `<div style="margin-bottom: 45px;">`;
        htmlTexte += `<b>Fractures régionales et modèles d'États</b><br>`;
        htmlTexte += `La disposition des bulles ne doit rien au hasard : elle dessine les grands modèles européens. En haut à droite, les pays <b>Nordiques et Continentaux</b> assument un État-providence très lourd. <b>${formatSujet(paysMaxRatio.pays)}</b> en est le meilleur exemple, réinvestissant <b style="color:#0CBBCC;">${paysMaxRatio.ratioDepense.toFixed(1)}%</b> de son PIB dans ses services publics. À l'inverse, dans le bloc de l'<b>Est</b> et du <b>Sud</b>, l'ampleur de l'État est plus contenue : <b>${formatSujet(paysMinRatio.pays)}</b> ferme la marche avec un ratio de dépense publique de seulement <b style="color:#0CBBCC;">${paysMinRatio.ratioDepense.toFixed(1)}%</b>.`;
        htmlTexte += `</div>`;

        // Paragraphe 3 : Bilan Global
        htmlTexte += `<div style="margin-bottom: 25px;">`;
        htmlTexte += `<b>Que peut-on conclure de tout ça ?</b><br>`;
        htmlTexte += `<i>Avec toutes ces informations, on peut sembler un peu perdu. On compare des budgets avec de la qualité de vie ou encore des PIB. Pas facile de s'y retrouver. Ce que l'on peut remarquer c'est que le <b>Luxemboug</b> est clairement au dessus du lot. Sans doute lié à sa force économique. Petit remarque pour l'<b>Irlande</b> qui voit son PIB s'envoler dans les années 2010. Serait-ce dû au tapis rouge déroulé aux <b>GAFAM</b> ?<br>Dans le domaine de l'enseignement, il n'y a pas de solution miracle, avec du budget ou non, les compétences n'évoluent pas toujours dans le bon sense. On remarque quand même que les pays de l'<B>Est</b> sont les bons élèves de l'Europe.<br>Et la <b>France</b> dans tout ça ? Elle semble plutôt dans la moyenne un peu partout.</i>`;
        htmlTexte += `</div>`;

        htmlTexte += `</div>`; 

        // --- FOOTER / SIGNATURE ---
        
        htmlTexte += `<div style="margin-top: auto; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8;">`;
        htmlTexte += `Réalisé par <b style="color:#64748b;">Brice RENOUF</b> dans le cadre du <b style="color:#64748b;">Hackaviz 2026</b> organisé par l'association <b style="color:#64748b;">Toulouse-Dataviz</b>.`;
        htmlTexte += `</div>`;

        htmlTexte += `</div>`; 

        texteContainer.html(htmlTexte);

        texteContainer.html(htmlTexte);

    } catch(error) {
        console.error("Erreur génération texte Page 3 :", error);
    }
}


// --- INTERRUPTEUR DE VUES (PAGE 1) ---
d3.select("#btn-mode-pourcent").on("click", function() {
    if (modeCalculPage1 === "pourcentage") return;
    modeCalculPage1 = "pourcentage";
    d3.select(this).classed("actif", true);
    d3.select("#btn-mode-habitant").classed("actif", false);
    mettreAJourDonnees(categorieActuelle); // On relance le calcul
});

d3.select("#btn-mode-habitant").on("click", function() {
    if (modeCalculPage1 === "habitant") return;
    modeCalculPage1 = "habitant";
    d3.select(this).classed("actif", true);
    d3.select("#btn-mode-pourcent").classed("actif", false);
    mettreAJourDonnees(categorieActuelle); // On relance le calcul
});

// ==========================================
// --- GESTION DU REDIMENSIONNEMENT ÉCRAN ---
// ==========================================
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    
    // On attend un quart de seconde après la fin du redimensionnement pour ne pas faire bugger le navigateur
    resizeTimer = setTimeout(function() {
        
        // On redessine le graphique des compétences (Page 2) s'il y a un pays sélectionné
        const paysSelectionne = d3.select("#filtre-pays").property("value");
        if (paysSelectionne && paysSelectionne !== "") {
            dessinerGraphiqueCompetences(paysSelectionne);
        }
        
        // On redessine le graphique à bulles (Page 3)
        const anneeEnCours = parseInt(d3.select("#slider-annee").property("value")) || 2023;
        dessinerBubbleLandscape(anneeEnCours);
        
    }, 250);
});