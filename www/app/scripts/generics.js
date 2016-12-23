var codigo = '40171002';
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
var sumarCreditos = function (prematricula, propia) {
	var crd = 0;
	_.each(prematricula, function (g) {
		if (g.propia == (propia ? 1 : 0)) {
			crd += g.creditos;
		}
	});
	return crd;
};
//FIN UTILITARIOS