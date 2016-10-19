var codigo = '50161018';
//UTILITARIOS
var alerta = function (texto, tipo) {
	var tipotxt = undefined;
	switch(tipo) {
	case 1:
		tipotxt = 'info';
		break;
	case 2:
		tipotxt = 'success';
		break;
	case 3:
		tipotxt = 'warning';
		break;
	case 4:
		tipotxt = 'danger';
		break;
	default:
		tipotxt = 'info';
	}
	$.notify({
		message: texto
	},{
		type: tipotxt,
		z_index: 1090
	});
};
var formatearHora = function (hora) {
	return _.isUndefined(hora) ? '' : hora.substring(0, 2);
};
var ajustarHorarios = function (grupos) {
	_.each(grupos, function (gr) {
		if (gr.horario.length != 6) {
			gr.horario = _.sortBy(gr.horario, function(h){return h.idDia;});
			var hrs = [];
			var j = 0;
			for (var i = 0; i <= 5; i++) {
				if (j < gr.horario.length && gr.horario[j].idDia == i) {
					gr.horario[j].hora = _.sortBy(gr.horario[j].hora, 'inicio');
					hrs.push(gr.horario[j]);
					j ++;
				} else {
					hrs.push(null);
				}
			}
			gr.horario = hrs;
		}
	});
};
var crearRangos = function (hrs) {
	var rangos = [];
	_.each(hrs, function (hr) {
		if (!_.isNull(hr)) {
			_.each(hr.hora, function (h) {
				var start = moment('1900-01-0' + (hr.idDia+1) + ' ' + h.inicio, 'YYYY-MM-DD HH:mm');
				var end = moment('1900-01-0' + (hr.idDia+1) + ' ' + h.fin, 'YYYY-MM-DD HH:mm');
				rangos.push(moment.range(start, end));
			});
		}
	});
	return rangos;
};
var validarCruce = function (gr, rgs2, marcar) {
	var rgs1 = crearRangos(gr.horario);
	var seCruza = false;
	_.each(rgs1, function (r1) {
		_.each(rgs2, function (r2) {
			if (r1.overlaps(r2)) {
				seCruza = true;
				if (marcar) {
					$('#' + gr.consecutivo).addClass('danger');
				}
			}
		});
	});
	return seCruza;
};
var validarCruceIns = function (gr, grs) {
	if (_.isEmpty(grs)) {
		return false;
	}
	return validarCruce(gr, crearRangos(_.flatten(_.pluck(_.flatten(_.pluck(grs, 'grupos')), 'horario'))), false);
};
var marcarCruces = function (grs1, grs2) {
	var rgs2 = crearRangos(_.flatten(_.pluck(grs2, 'horario')));
	_.each(grs1, function (gr) {
		validarCruce(gr, rgs2, true);
	});
};
//FIN UTILITARIOS
//Objeto para mantener saber cuales materias ya fueron filtradas por cupo.
var cupos = [];
//MVVM
var PrematriculaVM = function () {
	var self = this;
	self.user = ko.observable();
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
	self.oferta = ko.observableArray();
	self.mPlan = ko.observable();
	self.loadUser = function () {
		$('#loading').modal();
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
			url: 'http://zeus.lasalle.edu.co/oar/prematricula/cualquiera.php?opt=pr_oferta_json&p_opcion=1&p_codigo=' + codigo,
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
		}
		var m = _.clone(self.mPlan());
		m.grupos = [];
		m.grupos.push(grupo);
		self.prematricula.push(m);
		alerta('Materia inscrita con exito.', 2);
		$('#gruposModal').modal('hide');
	};
	self.eliminar = function (grupo) {
		self.prematricula.remove(grupo);
		var m = $('#' + grupo.codMateria);
		if (m.hasClass('success')) {
			m.removeClass('success');
			var mp = _.findWhere(self.oferta(), {codMateria: grupo.codMateria});
			if (!_.isUndefined(mp) && _.isEmpty(mp.grupos)) {
				mp.grupos = grupo.grupos;
				mp.grupos[0].cupo = 1;
			}
		}
		alerta('Grupo eliminado con exito.', 2);
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