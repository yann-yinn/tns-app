/**
 * Calculs des charges d'une EULR en fonction des paramètres
 */
angular.module('calculator').service('chargesCalculatorService',['chargesConfig2016', 'chargesTranchesCalculatorService', function(chargesConfig2016, chargesTranchesCalculatorService){

  /**
   * @param params object avec les propriétés suivantes:
   *
   * - chiffreAffaireHt
   * - chiffreAffaireTtc
   * - remuneration
   * - frais
   * - cfe
   */
  return (params) => {

    const service = {};

    const chargesConfig = chargesConfig2016;

    service.chiffreAffaireTtc = params.chiffreAffaireTtc;
    service.chiffreAffaireHt = params.chiffreAffaireHt;
    service.remuneration = params.remuneration;
    service.frais = params.frais;
    service.cfe = params.cfe;
    service.tva = params.tva;
    service.prevoyance = params.prevoyance;

    /**
     * @FIXME réecrire
     * @returns {*}
     */
    service.getPrevoyance = () => {

      let classeChoisie = null;
      chargesConfig2016.charges.prevoyance.classes.forEach((classe) => {
        if (classe.classe == service.prevoyance) {
          classeChoisie = classe;
        }
      });

      let charge = chargesConfig2016.charges.prevoyance;
      if (classeChoisie) {
        charge.label = "Prévoyance classe " + classeChoisie.classe;
        charge.montant = classeChoisie.montant_forfaitaire;
      }
      else {
        charge.montant = chargesConfig2016.charges.prevoyance.classes[0].montant_forfaitaire;
      }

      return charge;
    };

    service.getBaseCalculIs = () => {
      return service.chiffreAffaireHt - service.remuneration - service.frais;
    };

    service.getTva = () => {
      return {
        label: 'TVA',
        organisme: 'Impots',
        montant: service.tva
      }
    };

    /**
     * Pseudo charge
     */
    service.getCfe = () => {
      // pseudo calcul : on fait ça juste pour récupérer les meta-données déjà définies
      // dans la configuration des charges (l'objet charge avec son label, son commentaire etc ...)
      const charge = chargesTranchesCalculatorService.calculerTrancheExclusive(0, chargesConfig.charges.cfe);
      // on fixe le montant manuellement.
      charge.montant = service.cfe;
      return charge;
    };

    /**
     * pseudo charge
     * @returns {{label: string, montant: (number|*)}}
     */
    service.getFrais = () => {
      return {
        label: 'Frais',
        montant: service.frais
      };
    };

    service.getBenefice = () => {

      // comme on compte la TVA dans ce que nous devons provisionner,
      // il faut l'ajouter ici pour avoir un bénéfice juste
      // @FIXME il faudrait compter le chiffre d'affaire TTC,
      // puis que la tva dûe + chiffreAffaireHT != CA TTC
      let montant = service.chiffreAffaireHt + service.tva
        - service.getTotalAProvisionner().montant
        - service.remuneration
        - service.frais;

      return {
        label: "Bénéfice après provisions",
        montant: montant
      };
    };

    service.getCotisationsSocialesArray = () => {
      return [
        service.getAssuranceVieillesseBase(service.remuneration),
        service.getAssuranceVieillesseComplementaire(service.remuneration),
        service.getFormationProfessionnelle(service.remuneration),
        service.getAllocationsFamiliales(service.remuneration),
        service.getMaladiesMaternite(service.remuneration)
      ];
    };

    /**
     * Obtenir le montant total des cotisations sociales
     * @returns {number}
     */
    service.calculerTotalCotisationsSociales = () => {
      var total = 0;
      service.getCotisationsSocialesArray().forEach(item => total += item.montant);
      return total;
    };

    /**
     * Le total a provisionner, ce pour quoi j'ai créer l'application
     * c'est à dire ce qui devra être payé un jour ou l'autre, peu
     * nous importe la date d'ailleurs peu prédictible.
     * à un moement donné.
     * @returns {*}
     */
    service.getTotalAProvisionner = () => {
      let totalCotisationsSociales = service.calculerTotalCotisationsSociales();
      let total = service.cfe
        + service.tva
        + totalCotisationsSociales
        + service.getCgsCrds().montant
        + service.getPrevoyance().montant
        + service.getImpotSurLesSocietes().montant;
      return {
        id:'totalAProvisionner',
        label:'Total à provisionner',
        montant:total
      };
    };

    service.getTotalCotisationsSociales = () => {
      return {
        label: 'Cotisations sociales',
        montant: service.calculerTotalCotisationsSociales()
      }
    };

    /**
     * Calcul des cotisations maladie et maternité - URSSAF
     */
    service.getAssuranceVieillesseComplementaire = (baseCalcul) => {
      return chargesTranchesCalculatorService.calculerTrancheExclusive(baseCalcul, chargesConfig.charges.assuranceVieillesseComplementaire);
    };

    /**
     * Calcul des cotisations pour la formation professionnelle
     */
    service.getFormationProfessionnelle = (baseCalcul) => {
      return chargesTranchesCalculatorService.calculerTrancheExclusive(baseCalcul, chargesConfig.charges.formationProfessionnelle);
    };

    /**
     * Calcul des cotisations maladie et maternité - URSSAF
     */
    service.getAllocationsFamiliales = (baseCalcul) => {
      return chargesTranchesCalculatorService.calculerTrancheExclusive(baseCalcul, chargesConfig.charges.allocationsFamiliales);
    };

    /**
     * Calcul des cotisations maladie et maternité - CIPAV
     * @FIXME calcul chelou, à vérifier
     */
    service.getAssuranceVieillesseBase = (baseCalcul) => {
      let assuranceVieillesseBase = angular.copy(chargesConfig.charges.assuranceVieillesseBase);
      if (baseCalcul > assuranceVieillesseBase.tranches[0].plafond) {
        delete assuranceVieillesseBase.tranches[0];
      }
      let result = chargesTranchesCalculatorService.calculerTranchesCumulatives(baseCalcul, assuranceVieillesseBase);
      return result;
    };

    /**
     * Calcul des cotisations maladie et maternité - URSSAF
     */
    service.getMaladiesMaternite = (baseCalcul) => {
      return chargesTranchesCalculatorService.calculerTrancheExclusive(baseCalcul, chargesConfig.charges.maladiesMaternite);
    };

    /**
     * Calcul de l'impot sur les bénéfices - Impots
     */
    service.getImpotSurLesSocietes = () => {
      return chargesTranchesCalculatorService.calculerTranchesCumulatives(service.getBaseCalculIs(), chargesConfig.charges.impotSurLesSocietes);
    };

    /**
     * Calcul de l'impot sur les bénéfices - Impots
     */
    service.getCgsCrds= () => {
      const baseCalcul = service.remuneration + service.getTotalCotisationsSociales().montant;
      return chargesTranchesCalculatorService.calculerTranchesCumulatives(service.getBaseCalculIs(), chargesConfig.charges.cgsCrds);
    };

    return service;

  }

}]);

