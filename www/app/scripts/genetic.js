var Individuo = function () {
	var self = this;
	self.metrica = undefined;
	self.cromosomas = [];
	self.getMetrica = function () {
		try {
			if (_.isUndefined(self.cromosomas) || _.isEmpty(self.cromosomas)) {
				return 1e6;
			}
			var m = 0;
			var rgs = crearRangos(_.flatten(_.pluck(_.flatten(_.pluck(self.cromosomas, 'grupos')), 'horario')));
			rgs = _.sortBy(rgs, function (r) {
				return moment(r.start).unix();
			});
			var anterior = undefined;
			var dia = -1;
			_.each(rgs, function (r) {
				if (_.isUndefined(anterior) || dia != moment(r.start).day()) {
					dia = moment(r.start).day();
				} else {
					m += (moment(r.start).unix() - moment(anterior.end).unix());
				}
				anterior = r;
			});
			self.metrica = m;
			return m;
		} catch (err) {
			console.log(err);
			return 1e7;
		}
	};
	self.seleccionar = function (contrincante) {
		try {
			return self.getMetrica() < contrincante.getMetrica() ? self : contrincante;
		} catch (err) {
			console.log(err);
			return undefined;
		}
	};
	self.cruzar = function (pareja) {
		var hijo = new Individuo();
		var padres = [self, pareja];
		var i = 0;
		try {
			_.each(self.cromosomas, function () {
				var j = Math.ceil(Math.random() * 1000) % 2;
				var k = j == 0 ? 1 : 0;
				if (!validarCruceIns(padres[j].cromosomas[i].grupos[0], hijo.cromosomas)) {
					hijo.cromosomas.push(padres[j].cromosomas[i]);
				} else if (!validarCruceIns(padres[k].cromosomas[i].grupos[0], hijo.cromosomas)) {
					hijo.cromosomas.push(padres[k].cromosomas[i]);
				} else {
					throw new Error('hijo no viable');
				}
				i ++;
			});
			return hijo;
		} catch (err) {
			console.log(err.message);
			return undefined;
		}
	};
};
var Evolucion = function (oferta) {
	var self = this;
	self.oferta = oferta;
	self.individuos = [];
	self.filtrarCupos = function () {
		var ids = _.uniq(_.pluck(_.flatten(_.pluck(self.oferta, 'grupos')), 'consecutivo'));
		$.ajax({
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=8&p_codigo=' + ids.toString(),
			type: 'get',
			dataType: 'json',
			contentType: 'application/json;charset=utf-8',
			async: false,
			success: function (data) {
				if (!_.isArray(data) || _.isEmpty(data)) {
					return;
				}
				var c = _.reject(data, function(cp){return cp.cupo == 0;});
				_.each(self.oferta, function (mat) {
					var grConCupo = [];
					_.each(mat.grupos, function (gr) {
						if (!_.isUndefined(_.findWhere(c, {consecutivo: gr.consecutivo}))) {
							grConCupo.push(gr);
						}
					});
					mat.grupos = grConCupo;
				});
			},
			error: function (jqXHR, textStatus, errorThrown) {
				console.log(errorThrown);
			}
		});
	};
	self.init = function (poblacionInicial) {
		console.log('-------Poblacion Inicial-------');
		self.filtrarCupos();
		var intentos = 0;
		for (var i = 0; i < poblacionInicial; i++) {
			if (intentos >= 10) {
				throw new Error('Poblacion incompleta: intentos maximos de creacion superados');
			}
			var ofert = _.sortBy(self.oferta, function (o) {return Math.random();});
			var individuo = new Individuo();
			try {
				_.each(ofert, function (mat) {
					ajustarHorarios(mat.grupos);
					var m = _.clone(mat);
					m.grupos = [];
					var grs = _.sortBy(mat.grupos, function (g) {return Math.random();});
					var indicador = 0;
					for (var j = 0; j < grs.length; j++) {
						if (!validarCruceIns(grs[j], individuo.cromosomas)) {
							m.grupos.push(grs[j]);
							indicador = 1;
							break;
						}
					}
					if (indicador == 0) {
						throw new Error('Individuo incompleto');
					}
					individuo.cromosomas.push(m);
				});
				individuo.cromosomas = _.sortBy(individuo.cromosomas, function (c) {return c.codMateria;});
				self.individuos.push(individuo);
				intentos = 0;
			} catch (err) {
				console.log(err.message);
				i--;
				intentos++;
			}
		}
		console.log('-------Poblacion Inicial-------');
	};
	self.getNuevaGeneracion = function (poblacion) {
		var nuevaGeneracion = [];
		for (var i = 0; i < Math.ceil(poblacion / 2); i++) {
			nuevaGeneracion.push(self.individuos[i]);
		}
		for (var i = 0; i < Math.ceil(poblacion / 2); i++) {
			for (var j = i+1; j < Math.ceil(poblacion / 2); j++) {
				var ni = nuevaGeneracion[i].cruzar(nuevaGeneracion[j]);
				if (!_.isUndefined(ni)) {
					nuevaGeneracion.push(ni);
				}
			}
		}
		self.individuos = nuevaGeneracion;
	};
	self.calcularUnBuenHorario = function (poblacionInicial, numGneraciones) {
		var generacion = 0;
		self.init(poblacionInicial);
		do {
			self.individuos = _.sortBy(self.individuos, function (i) {return i.getMetrica();});
			console.log(' >> ' + generacion + ': ' + self.individuos[0].metrica + ' (' + self.individuos.length + ')');
			if (!_.isUndefined(self.individuos[0].metrica) && self.individuos[0].metrica == 0) {
				return self.individuos[0];
			}
			self.getNuevaGeneracion(poblacionInicial);
			generacion ++;
		} while (generacion < numGneraciones);
		return self.individuos[0];
	};
};
