
'use strict';

var ArcClock = function(config) {
  var defaultConfig = {
    // Radii
    centerRadius: 90,
    hourInner: 100,
    hourOuter: 120,
    minuteInner: 140,
    minuteOuter: 160,
    secondInner: 180,
    secondOuter: 200,
    waveInner: 220,
    waveOuter: 240,

    // Visibility
    showHour: true,
    showMinute: true,
    showSecond: true,
    showWave: true,
    showCenter: true,

    // Colour
    centerColour: '#333',
    centerTextColour: '#DDD',
    hourColour: '#369',
    minuteColour: '#69C',
    secondColour: '#9CF',
    waveColour: '#9CF',

    // Number of waves
    waves: 3
  };


  config = config || {};
  Object.keys(defaultConfig).forEach(function(key) {
    if (!config.hasOwnProperty(key)) {
      config[key] = defaultConfig[key];
    }
  });

  this.config = config;
};


ArcClock.prototype.render = function(id) {
  var svg, center;
  var arcSecond, arcMinute, arcHour;
  var config = this.config;
  var width = 750;
  var height = 750;


  svg = d3.select(id).append('svg')
    .attr('viewBox', '0 0 ' + width + ' ' + height)
    .attr('preserveAspectRatio', 'xMidYMid')
    .append('g')
    .attr('transform', 'translate(' + 0.5*width+ ',' + 0.5*height+ ')');

  center =  svg.append('g');


  arcSecond = d3.svg.arc()
    .innerRadius(config.secondInner)
    .outerRadius(config.secondOuter)
    .cornerRadius(3);

  arcMinute = d3.svg.arc()
    .innerRadius(config.minuteInner)
    .outerRadius(config.minuteOuter)
    .cornerRadius(3);

  arcHour = d3.svg.arc()
    .innerRadius(config.hourInner)
    .outerRadius(config.hourOuter)
    .cornerRadius(3);


  var hours = svg.append('path')
    .datum({ startAngle: 0, endAngle: 0.0001 })
    .attr('d', arcHour).style('fill', config.hourColour);

  var minutes = svg.append('path')
    .datum({ startAngle: 0, endAngle: 0.0001 })
    .attr('d', arcMinute).style('fill', config.minuteColour);

  var seconds = svg.append('path')
    .datum({ startAngle: 0, endAngle: 0.0001 })
    .attr('d', arcSecond).style('fill', config.secondColour);



  function seconds2Radians(s) {
    return 2 * s / 60 * Math.PI;
  }

  function minutes2Radians(s) {
    return 2 * s / 3600 * Math.PI;
  }

  function hours2Radians(s) {
    return 2 * s / (12*3600) * Math.PI;
  }

  function renderWave() {
    for (var i=0; i < 60; i++) {
      var _secodnStart = seconds2Radians(i);
      var arc = d3.svg.arc()
        .innerRadius(config.waveInner)
        .outerRadius(config.waveOuter + 35*Math.abs(Math.cos(Math.PI*i/ (60/config.waves) ) ))
        .startAngle( seconds2Radians( (i-0.43)%60))
        .endAngle( seconds2Radians( (i+0.43)%60));

      svg.append('path')
        .datum({val: i})
        .attr('class', 'sec')
        .attr('d', arc).style('fill', config.waveColour).style('opacity', 0.15);
    }
  }


  function arcTweenH(transition, hoursStart) {
    transition.attrTween('d', function(d) {
      var interpolateStart = d3.interpolate(hoursStart, hoursStart + hours2Radians(1));

      return function(t) {
        d.startAngle = interpolateStart(t) + hours2Radians(20*60);  // inc 1/2 hour
        d.endAngle = interpolateStart(t) + 2*Math.PI - hours2Radians(20*60);
        return arcHour(d);
      };
    });
  }

  function arcTweenM(transition, minutesStart) {
    transition.attrTween('d', function(d) {

      var interpolateStart = d3.interpolate(minutesStart, minutesStart + minutes2Radians(1));
      return function(t) {
        d.startAngle = interpolateStart(t) + minutes2Radians(30);
        d.endAngle = interpolateStart(t) + 2*Math.PI - minutes2Radians(30);
        return arcMinute(d);
      };
    });
  }

  function arcTweenS(transition, secondsStart) {
    transition.attrTween('d', function(d) {

      var interpolateStart = d3.interpolate(secondsStart, secondsStart + seconds2Radians(1));
      return function(t) {
        d.startAngle = interpolateStart(t) + seconds2Radians(0.5);
        d.endAngle = interpolateStart(t) + 2*Math.PI - seconds2Radians(0.5);
        return arcSecond(d);
      };
    });
  }

  function nextTick() {
    var now = new Date();
    var _seconds = now.getSeconds();
    var _minutes = now.getMinutes();
    var _hours = now.getHours() % 12;
    var _secondsStart = seconds2Radians((_seconds-1)%60);
    var _minutesStart = minutes2Radians(_minutes*60 + _seconds);
    var _hoursStart = hours2Radians(_hours * 60*60 + _minutes*60 + _seconds);

    var dateStr = (_hours < 10? '0' + _hours : _hours) + ':' +
      (now.getMinutes() < 10? '0' + now.getMinutes() : now.getMinutes()) + ':' +
      (now.getSeconds() < 10? '0' + now.getSeconds() : now.getSeconds());

    if (_seconds === 0) {
      d3.selectAll('.sec').style('opacity', 0.05);
    }
    d3.selectAll('.sec').filter(function(d) {
      return d.val <= _seconds;
    }).transition().duration(300).style('opacity', 1.0);

    if (config.showSecond) {
      seconds.style('visibility', 'visible');
    } else {
      seconds.style('visibility', 'hidden');
    }
    if (config.showMinute) {
      minutes.style('visibility', 'visible');
    } else {
      minutes.style('visibility', 'hidden');
    }
    if (config.showHour) {
      hours.style('visiblity', 'visible');
    } else {
      hours.style('visiblity', 'hidden');
    }

    if (config.showCenter) {
      center.style('visibility', 'visible');
    } else {
      center.style('visibility', 'hidden');
    }



    seconds.transition().duration(300)
      .call(arcTweenS, _secondsStart);

    minutes.transition().duration(300)
      .call(arcTweenM, _minutesStart);

    hours.transition().duration(300)
      .call(arcTweenH, _hoursStart);

    center.select('text').text(dateStr);
  }


  // Start rendering
  renderWave();
  center.append('circle')
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', config.centerRadius)
    .style('fill', config.centerColour);

  center.append('text')
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .style('fill', config.centerTextColour)
    .style('font-family', 'Tahoma');

   // Start
  nextTick();
  setInterval(nextTick, 1000);
}
