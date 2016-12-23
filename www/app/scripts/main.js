//Objeto para mantener saber cuales materias ya fueron filtradas por cupo.
var cupos = [];
//MVVM
var MateriaItem = function () {
	var self = this;
	self.materia = ko.observable();
	self.selected = ko.observable(false);
};
var PrematriculaVM = function () {
	var self = this;
	self.user = ko.observable();
	self.userDt = ko.observable();
	self.creditosMax = ko.observableArray();
	self.prematricula = ko.observableArray();
	self.prematricula.subscribe(function (newPrem) {
		$('#tMatPlan tbody tr').each(function () {
			$(this).removeClass('info');
		});
		_.each(newPrem, function (p) {
			var m = $('#' + p.codMateria);
			if (!m.hasClass('danger')) {
				m.addClass('info');
			}
		});
	});
	//------------------------------------------------------------------------------
	//FUNCIONES PARA EL CALCULO DEL RESUMEN DE CREDITOS
	// 1. SEMESTRE INFERIOR
	self.semestreInf = function () {
		var p = _.reject(self.prematricula(), function (g) {return g.propia != 1;});
		if (self.user().perfil == 'NV') {
			return 1;
		} else if (_.isEmpty(p)) {
			return 0;
		}
		return _.min(_.pluck(p, 'semestre'));
	};
	self.semestreInfDt = function () {
		if (_.isUndefined(self.userDt())) {
			return undefined;
		}
		return self.userDt().semestreInferior;
	};
	self.semestreInfResumen = function () {
		if (self.semestreInf() <= 0) {
			return self.semestreInfDt();
		} else if (self.semestreInfDt() <= 0) {
			return self.semestreInf();
		}
		return _.min([self.semestreInf(), self.semestreInfDt()]);
	};
	// 2. SUMATORIA DE CREDITOS PREMATRICULADOS
	self.sumCreds = function () {
		return sumarCreditos(self.prematricula(), true);
	};
	self.sumCredsPrn = function () {
		var uno = self.sumCreds();
		var cmax = self.crMax();
		return cmax < uno ? cmax + ' (' + (uno - cmax) + ')' : uno + '(0)';
	};
	self.sumCredsDt = function () {
		return sumarCreditos(self.prematricula(), false);
	};
	self.sumCredsDtPrn = function () {
		var uno = self.sumCredsDt();
		var cmax = self.crMaxDt();
		return cmax < uno ? cmax + ' (' + (uno - cmax) + ')' : uno + '(0)';
	};
	self.sumCredsResumen = function () {
		if (_.isUndefined(self.userDt())) {
			return undefined;
		}
		var uno = self.sumCreds();
		var dos = self.sumCredsDt();
		var credMax = self.crMaxResumen();
		return credMax < uno + dos ? credMax + ' (' + (uno + dos - credMax) + ')' : (uno + dos) + ' (0)';
	};
	// 3. CREDITOS MAXIMOS POR SEMESTRE INFERIOR
	self.crMax = function () {
		if (_.isEmpty(self.creditosMax())) {
			return 0;
		}
		var cm = _.findWhere(self.creditosMax(), {semestre: self.semestreInf()});
		return _.isUndefined(cm) ? 0 : cm.creditos;
	};
	self.crMaxDt = function () {
		if (_.isUndefined(self.userDt())) {
			return undefined;
		}
		return self.userDt().creditosMax;
	};
	self.crMaxResumen = function () {
		if (_.isUndefined(self.userDt())) {
			return undefined;
		}
		if (self.sumCreds() > self.sumCredsDt()) {
			return self.crMax();
		} else if (self.sumCreds() < self.sumCredsDt()) {
			return self.crMaxDt();
		} else if (self.semestreInf() < self.semestreInfDt()) {
			return self.crMax();
		} else if (self.semestreInf() > self.semestreInfDt()) {
			return self.crMaxDt();
		} else {
			if (self.user().codigo < self.userDt().codigo) {
				return self.crMax();
			}
			return self.crMaxDt();
		}
	};
	// 4. RESUMEN TOTAL PARA DT
	self.resumenCrs = ko.computed(function () {
		if (_.isUndefined(self.user())) {
			return [];
		} else if (_.isUndefined(self.userDt())) {
			return [{cod: self.user().codigo, semInf: self.semestreInf(), crMax: self.crMax(), crExt: self.user().creditosExtra, sumCreds: self.sumCredsPrn()}];
		}
		return [
			{cod: self.user().codigo, semInf: self.semestreInf(), crMax: self.crMax(), crExt: self.user().creditosExtra, sumCreds: self.sumCredsPrn(), resumen: 0},
			{cod: self.userDt().codigo, semInf: self.semestreInfDt(), crMax: self.crMaxDt(), crExt: self.userDt().creditosExtra, sumCreds: self.sumCredsDtPrn(), resumen: 0},
			{cod: null, semInf: self.semestreInfResumen(), crMax: self.crMaxResumen(), crExt: null, sumCreds: self.sumCredsResumen(), resumen: 1}
		];
	}, self);
	//FIN RESUMEN CREDITOS
	//------------------------------------------------------------------------------
	//FUNCIONES PARA QUIENES TIENEN MINIMO DE CREDITOS A PREMATRICULAR
	self.tieneMinCreditos = function () {
		var re = new RegExp('^NV|RI$');
		return !_.isUndefined(self.user()) && re.test(self.user().perfil);
	};
	self.esNuevo = ko.computed(function () {
		var re = new RegExp('^NV$');
		return !_.isUndefined(self.user()) && re.test(self.user().perfil);
	}, self);
	self.minCreditos = function () {
		if (_.isUndefined(self.user())) {
			return 999;
		} else if (self.user().perfil == 'RI') {
			return 9;
		} else if (self.user().perfil == 'NV') {
			return self.crMax();
		}
		return 0;
	};
	self.cumpleMinCreditos = function () {
		return self.sumCreds() >= self.minCreditos();
	};
	self.cumpleMinCreditosCom = ko.computed(function () {
		var cumple = self.cumpleMinCreditos();
		if (cumple) {
			$('#btn-save').animateCss('tada');
		}
		return cumple;
	}, self);
	//FIN MINIMO CREDITOS
	//------------------------------------------------------------------------------
	self.oferta = ko.observableArray();
	self.mPlan = ko.observable();
	self.mPlanDel = ko.observable();
	self.validarCredMax = function (mt, add) {
		var si = self.semestreInf();
		if (add) {
			si = si == 0 || si > mt.semestre ? mt.semestre : si;
		} else {
			var newprem = _.reject(self.prematricula(), function (g) {return g.codMateria == mt.codMateria;});
			if (_.isEmpty(newprem)) {
				return true;
			}
			si = _.min(_.pluck(_.reject(newprem, function (g) {return g.semestre <= 0;}), 'semestre'));
		}
		var cm = _.findWhere(self.creditosMax(), {semestre: si});
		if (_.isUndefined(cm)) {
			return false;
		}
		return self.sumCreds() + (mt.creditos * (add ? 1 : -1)) <= cm.creditos;
	};
	self.loadCreditosMax = function () {
		if (_.isUndefined(self.user())) {
			alerta('Sin estudiante no se puede calcular los creditos maximos.', 4);
			return;
		}
		$.ajax({
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=4&p_codigo=' + self.user().codigo,
			type: 'get',
			dataType: 'json',
			contentType: 'application/json;charset=utf-8',
			success: function (data) {
				try {
					self.validarRespuesta(data, true);
					self.creditosMax(data);
				} catch (err) {
					if (err != 'mensaje') {
						$('#loading').modal('hide');
						self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
						$('#aviso').modal();
					}
				}
			},
			error: function (jqXHR, textStatus, errorThrown) {
				$('#loading').modal('hide');
				self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
				$('#aviso').modal();
			}
		});
	};
	self.loadUser = function () {
		$('#loading').modal();
		self.userDt(undefined);
		$.ajax({
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=3&p_codigo=' + codigo,
			type: 'get',
			dataType: 'json',
			contentType: 'application/json;charset=utf-8',
			success: function (data) {
				try {
					self.validarRespuesta(data, true);
					self.user(data);
					$('#loading').modal('hide');
					self.loadOfert();
					self.loadCreditosMax();
					if (!_.isUndefined(data.codigoContrario)) {
						$.ajax({
							url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=3&p_codigo=' + data.codigoContrario,
							type: 'get',
							dataType: 'json',
							contentType: 'application/json;charset=utf-8',
							success: function (data) {
								try {
									self.validarRespuesta(data, true);
									self.userDt(data);
								} catch (err) {
									if (err != 'mensaje') {
										$('#loading').modal('hide');
										self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
										$('#aviso').modal();
									}
								}
							},
							error: function (jqXHR, textStatus, errorThrown) {
								$('#loading').modal('hide');
								self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
								$('#aviso').modal();
							}
						});
					}
				} catch (err) {
					if (err != 'mensaje') {
						$('#loading').modal('hide');
						self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
						$('#aviso').modal();
					}
				}
			},
			error: function (jqXHR, textStatus, errorThrown) {
				$('#loading').modal('hide');
				self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
				$('#aviso').modal();
			}
		});
	};
	self.loadPrematricula = function () {
		if (_.isUndefined(self.user())) {
			throw 'no se puede consultar la prematricula sin el usuario';
		}
		$('#loading').modal();
		$.ajax({
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=2&p_codigo=' + codigo,
			type: 'get',
			dataType: 'json',
			contentType: 'application/json;charset=utf-8',
			success: function (data) {
				try {
					self.validarRespuesta(data, true);
					_.each(data.materias, function (mPlan) {
						ajustarHorarios(mPlan.grupos);
					});
					self.prematricula(data.materias);
					$('#loading').modal('hide');
				} catch (err) {
					if (err != 'mensaje') {
						$('#loading').modal('hide');
						self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
						$('#aviso').modal();
					}
				}
			},
			error: function (jqXHR, textStatus, errorThrown) {
				$('#loading').modal('hide');
				self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
				$('#aviso').modal();
			}
		});
	};
	self.loadOfert = function () {
		if (_.isUndefined(self.user())) {
			throw 'no se puede consultar la oferta sin el usuario';
		}
		$('#loading').modal();
		$.ajax({
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=1&p_codigo=' + codigo + (self.user().perfil == 'NV' ? '&p_tipo=1' : ''),
			type: 'get',
			dataType: 'json',
			contentType: 'application/json;charset=utf-8',
			success: function (data) {
				try {
					self.validarRespuesta(data, true);
					self.oferta(data.materias);
					$('.barra').perfectScrollbar();
					$('#loading').modal('hide');
					self.loadPrematricula();
				} catch (err) {
					if (err != 'mensaje') {
						$('#loading').modal('hide');
						self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
						$('#aviso').modal();
					}
				}
			},
			error: function (jqXHR, textStatus, errorThrown) {
				$('#loading').modal('hide');
				self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
				$('#aviso').modal();
			}
		});
	};
	self.verHorarios = function (mPlan) {
		if (_.isUndefined(_.findWhere(cupos, {codMateria: mPlan.codMateria}))) {
			$('#loading').modal();
			var ids = _.pluck(mPlan.grupos, 'consecutivo');
			$.ajax({
				url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=8&p_codigo=' + ids.toString(),
				type: 'get',
				dataType: 'json',
				contentType: 'application/json;charset=utf-8',
				success: function (data) {
					try {
						self.validarRespuesta(data, false);
						var c = _.reject(data, function(cp){return cp.cupo == 0;});
						if (_.isEmpty(c)) {
							$('#loading').modal('hide');
							cupos.push({codMateria: mPlan.codMateria});
							mPlan.grupos = [];
							var m = $('#' + mPlan.codMateria);
							if (m.hasClass('info')) {
								m.addClass('success');
							} else {
								m.addClass('danger');
							}
							m.removeClass('info');
							alerta('No existen grupos con cupo para esta materia.', 4);
							$('#' + mPlan.codMateria).animateCss('shake');
							return;
						}
						var grs = [];
						_.each(c, function (cp) {
							grs.push(_.findWhere(mPlan.grupos, {consecutivo: cp.consecutivo}));
						});
						mPlan.grupos = grs;
						ajustarHorarios(mPlan.grupos);
						cupos.push({codMateria: mPlan.codMateria});
						$('#loading').modal('hide');
						self.mPlan(mPlan);
						if (!_.isEmpty(self.prematricula())) {
							marcarCruces(mPlan.grupos, _.flatten(_.pluck(self.prematricula(), 'grupos')));
						}
						$('.barra').perfectScrollbar();
						$('#gruposModal').modal();
					} catch (err) {
						if (err != 'mensaje') {
							$('#loading').modal('hide');
							self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
							$('#aviso').modal();
						}
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					$('#loading').modal('hide');
					self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
					$('#aviso').modal();
				}
			});
		} else {
			if ($('#' + mPlan.codMateria).hasClass('danger')) {
				$('#' + mPlan.codMateria).animateCss('shake');
				alerta('No existen grupos con cupo para esta materia.', 4);
				return;
			} else if ($('#' + mPlan.codMateria).hasClass('success')) {
				$('#' + mPlan.codMateria).animateCss('shake');
				alerta('No existen grupos con cupo para esta materia, pero no se preocupe, usted ya la tiene prematriculada.', 4);
				return;
			}
			self.mPlan(mPlan);
			if (!_.isEmpty(self.prematricula())) {
				marcarCruces(mPlan.grupos, _.flatten(_.pluck(self.prematricula(), 'grupos')));
			}
			$('.barra').perfectScrollbar();
			$('#gruposModal').modal();
		}
	};
	self.inscribir = function (grupo, event) {
		if (!_.isUndefined(_.findWhere(self.prematricula(), {codMateria: self.mPlan().codMateria}))) {
			$(event.currentTarget).animateCss('shake');
			alerta('Materia ya prematriculada.', 3);
			return false;
		} else if ($(event.currentTarget).hasClass('danger') || validarCruceIns(grupo, self.prematricula())) {
			$(event.currentTarget).animateCss('shake');
			alerta('No puede inscribir este horario porque presenta un cruce con su prematricula.', 3);
			return false;
		} else if (!self.validarCredMax(self.mPlan(), true)) {
			$(event.currentTarget).animateCss('shake');
			alerta('No puede inscribir este horario porque sobrepasa los creditos maximos para el semestre inferior.', 3);
			return false;
		}
		$('#gruposModal').modal('hide');
		if (_.isUndefined(self.prematricula()) || _.isEmpty(self.prematricula())) {
			self.prematricula([]);
		}
		if (!self.tieneMinCreditos()) {
			$('#loading').modal();
			$.ajax({
				url: 'http://zeus.lasalle.edu.co/oar/prematricula/dummy.php',
				type: 'post',
				//data: datos,
				dataType: 'json',
				contentType: 'application/json;charset=utf-8',
				success: function (data) {
					try {
						self.validarRespuesta(data, false);
						var m = _.clone(self.mPlan());
						m.grupos = [];
						m.grupos.push(grupo);
						/*Esto se agrega por que se adicionaron nuevas propiedades a la prematricula*/
						m.post = 0;
						m.propia = 1;
						/*fin*/
						self.prematricula.push(m);
						alerta('Materia inscrita con exito.', 2);
						$('#loading').modal('hide');
					} catch (err) {
						if (err != 'mensaje') {
							$('#loading').modal('hide');
							self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
							$('#aviso').modal();
						}
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					$('#loading').modal('hide');
					self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
					$('#aviso').modal();
				}
			});
		} else {
			var m = _.clone(self.mPlan());
			m.grupos = [];
			m.grupos.push(grupo);
			/*Esto se agrega por que se adicionaron nuevas propiedades a la prematricula*/
			m.post = 0;
			m.propia = 1;
			/*fin*/
			self.prematricula.push(m);
			alerta('Materia inscrita con exito.', 2);
			$('#aviso-mincred').animateCss('pulse');
		}
		
	};
	self.confirmar = function (grupo) {
		self.mPlanDel(grupo);
		$('#confirmationModal').modal();
	};
	self.eliminar = function () {
		$('#confirmationModal').modal('hide');
		if (_.isUndefined(self.mPlanDel())) {
			alerta('Seleccione un grupo para eliminar.', 4);
			return false;
		} else if (!self.validarCredMax(self.mPlanDel(), false)) {
			alerta('No puede eliminar este horario porque sobrepasa los creditos maximos para el semestre inferior.', 3);
			return false;
		} else if (self.mPlanDel().grupos[0].eliminable != 1) {
			alerta('No esta autorizado a eliminar este horario.', 4);
			return false;
		}
		
		if (!self.tieneMinCreditos()) {
			$('#loading').modal();
			$.ajax({
				url: 'http://zeus.lasalle.edu.co/oar/prematricula/dummy.php',
				type: 'post',
				//data: datos,
				dataType: 'json',
				contentType: 'application/json;charset=utf-8',
				success: function (data) {
					try {
						self.validarRespuesta(data, false);
						self.prematricula.remove(self.mPlanDel());
						var m = $('#' + self.mPlanDel().codMateria);
						if (m.hasClass('success')) {
							m.removeClass('success');
							var mp = _.findWhere(self.oferta(), {codMateria: self.mPlanDel().codMateria});
							if (!_.isUndefined(mp) && _.isEmpty(mp.grupos)) {
								mp.grupos = self.mPlanDel().grupos;
								mp.grupos[0].cupo = 1;
							}
						}
						alerta('Grupo eliminado con exito.', 2);
						$('#loading').modal('hide');
					} catch (err) {
						if (err != 'mensaje') {
							$('#loading').modal('hide');
							self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
							$('#aviso').modal();
						}
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					$('#loading').modal('hide');
					self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
					$('#aviso').modal();
				}
			});
		} else {
			self.prematricula.remove(self.mPlanDel());
			var m = $('#' + self.mPlanDel().codMateria);
			if (m.hasClass('success')) {
				m.removeClass('success');
				var mp = _.findWhere(self.oferta(), {codMateria: self.mPlanDel().codMateria});
				if (!_.isUndefined(mp) && _.isEmpty(mp.grupos)) {
					mp.grupos = self.mPlanDel().grupos;
					mp.grupos[0].cupo = 1;
				}
			}
			alerta('Grupo eliminado con exito.', 2);
			$('#aviso-mincred').animateCss('pulse');
		}
	};
	self.salvar = function () {
		if (self.tieneMinCreditos() && self.cumpleMinCreditos()) {
			$('#loading').modal();
			$.ajax({
				url: 'http://zeus.lasalle.edu.co/oar/prematricula/dummy.php',
				type: 'post',
				data: ko.toJSON(_.flatten(_.pluck(_.flatten(_.pluck(self.prematricula(), 'grupos')), 'consecutivo'))),
				dataType: 'json',
				contentType: 'application/json;charset=utf-8',
				success: function (data) {
					try {
						self.validarRespuesta(data, false);
						alerta('Prematricula almacenada con exito.', 2);
						$('#loading').modal('hide');
					} catch (err) {
						if (err != 'mensaje') {
							$('#loading').modal('hide');
							self.aviso({level: 1, header: 'Mensaje muy importante', body: err, closeable: false});
							$('#aviso').modal();
						}
					}
				},
				error: function (jqXHR, textStatus, errorThrown) {
					$('#loading').modal('hide');
					self.aviso({level: 1, header: 'No se logro porcesar la solicitud', body: !_.isUndefined(jqXHR.responseJSON) && !_.isUndefined(jqXHR.responseJSON.mensaje) ? jqXHR.responseJSON.mensaje : errorThrown, closeable: false});
					$('#aviso').modal();
				}
			});
		} else {
			$('#btn-save').animateCss('shake');
			alerta('No puede guardar porque no cumple con los requisitos.', 3);
			return false;
		}
	};
	self.validarRespuesta = function (data, bloqueante) {
		if (!_.isUndefined(data.exception) || (!_.isUndefined(data.status) && data.status != 'ok')) {
			$('#loading').modal('hide');
			self.aviso({level: 2, header: 'Mensaje importante', body: (!_.isUndefined(data.exception) ? data.exception : data.mensaje), closeable: !bloqueante});
			$('#aviso').modal();
			throw 'mensaje';
		}
	};
	self.aviso = ko.observable({level:1, header:'', body:'', closeable: true});
	//Horario genetico
	self.materiasSeleccionadasGen = ko.observableArray([]);
	self.tieneMatriculaCompleta = ko.observable(false);
	self.poblacionInicial = ko.observable(6);
	self.numGeneraciones = ko.observable(5);
	self.individuo = ko.observable();
	self.creditosGen = ko.computed(function () {
		if (_.isEmpty(self.materiasSeleccionadasGen())) {
			return '0/0 (s.i. 0)';
		}
		var sinf = _.min(_.pluck(self.materiasSeleccionadasGen(), 'semestre'));
		var cmax = _.findWhere(self.creditosMax(), {semestre: sinf});
		var crds = 0;
		_.each(self.materiasSeleccionadasGen(), function (m) {
			crds += m.creditos;
		});
		self.tieneMatriculaCompleta(crds == cmax.creditos);
		return crds + '/' + cmax.creditos + ' (s.i. ' + sinf + ')';
	}, self);
	self.ejecutarAsistente = function () {
		$('#geneticModal').modal('hide');
		$('#loading').modal();
		var ofert = [];
		_.each(self.materiasSeleccionadasGen(), function (mat) {
			var m = _.clone(mat);
			var p = _.findWhere(self.prematricula(), {codMateria: m.codMateria});
			m.inscrita = !_.isUndefined(p);
			if (m.inscrita) {
				m.grupos = p.grupos;
			} else {
				m.grupos = _.reject(mat.grupos, function (g) {
					return self.user().facultad.sede.sede != g.facultadCursar.sede.sede;
				});
			}
			ofert.push(m);
		});
		_.defer(function () {
			try {
				var evolution = new Evolucion(ofert);
				var ind = evolution.calcularUnBuenHorario(self.poblacionInicial(), self.numGeneraciones());
				self.individuo(ind);
				$('#loading').modal('hide');
				$('#individuoModal').modal();
			} catch (err) {
				$('#loading').modal('hide');
				self.aviso({level: 1, header: 'No se logro calcular el horario', body: err.message, closeable: true});
				$('#aviso').modal();
			}
		});
	};
	self.inscribirGen = function (cr, event) {
		$(event.currentTarget).attr('disabled', true);
		var m = _.clone(cr);
		m.grupos = [];
		self.mPlan(m);
		self.inscribir(cr.grupos[0], event);
	};
};
var premVM = new PrematriculaVM();
//FIN MVVM
//animate.css
$.fn.extend({
	animateCss: function (animationName) {
		var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
		this.addClass('animated ' + animationName).one(animationEnd, function() {
			$(this).removeClass('animated ' + animationName);
		});
	}
});
//fin animate.css
$(document).ready(function () {
	premVM.loadUser();
	ko.applyBindings(premVM);
});