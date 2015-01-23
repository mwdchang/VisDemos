(function() {
  'use strict';

  window.dcc = window.dcc || {};

  var ParallelPipe = function( data, config ) {

    /********************************************************************************
    *
    * histogramHeight = 0 ==> No histogram for ranked column
    *
    ********************************************************************************/
    var defaultConfig = {
      // Layout
      width: 700,
      height: 190,
      margin: 5,
      paddingTop: 5,
      paddingBottom: 20,
      paddingLeft: 45,
      paddingRight: 5,

      //histogramHeight: 40,
      //histogramPadding: 5,

      histogramHeight: 0,
      histogramPadding: 15,

      hspacing: 25,
      vspacing: 10,


      // Callback
    };


    // Check for custom configurations
    config = config || {};
    Object.keys(defaultConfig).forEach(function (key) {
      if (! config.hasOwnProperty(key)) {
        config[key] = defaultConfig[key];
      }
    });


    /* Basic layout */
    var length = data.length;
    var seriesLength = data[0].data.length;


    /********************************************************************************
    *
    * margin - paddingLeft - chart - paddingRight - margin
    *
    * margin
    *  padding-top
    *   histogramHeight
    *   histogramPadding
    *   chart
    *  padding-bottom
    * margin
    *
    ********************************************************************************/
    config.visWidth  = config.width - 2.0 * config.margin;
    config.visHeight = config.height - 2.0 * config.margin;
    config.chartWidth  = config.visWidth - (config.paddingLeft + config.paddingRight);
    config.chartHeight = config.visHeight - (config.paddingTop + config.paddingBottom);

    config.barWidth = (config.chartWidth - length * config.hspacing) / length;
    config.barHeight = ((config.chartHeight - config.histogramHeight - config.histogramPadding) - (seriesLength * config.vspacing)) / seriesLength;


    config.columnSize = config.barWidth + config.hspacing;



    console.log('parallel coord config', config);

    this.data = data;
    this.config = config;
    this.svg = undefined;
    this.vis = undefined;
    this.chart = undefined;


    this.series = _.pluck(this.data[0].data, 'id').sort();

    // Helper and utilities
    this.translate = function(x, y) {
      return 'translate(' + x + ',' + y + ')';
    };

    this.diagonal = d3.svg.diagonal().projection(function(d, i) {
      return [d.x, d.y];
    });


    this.diagonal2 = d3.svg.diagonal()
      .source(function(d) { return {x: d.source.y, y: d.source.x}; })
      .target(function(d) { return {x: d.target.y, y: d.target.x}; })
      .projection(function(d) { return [d.y, d.x]; });
  };



  ParallelPipe.prototype.renderDataLinks2 = function( element, computeOnly ) {
    var _this = this;
    var config = _this.config;
    // var links = _this.chart.append('g');
    var hSize = config.histogramHeight + config.histogramPadding;

    _this.data.forEach(function(columnData, columnIdx) {

      // TODO: ab-initio
      if (columnIdx === 0) {
        _this.data[0].data.forEach(function(currentItem) {
          var x1 = currentItem.px;
          var y1 = currentItem.py;
          var x2 = currentItem.px-15;

          if (_this.data[0].type && _this.data[0].type === 'categorical') {
            x2 -= 0.5 * config.barWidth;
          } else if (_this.data[0].type && _this.data[0].type === 'numeric') {
            x2 -= 0.5 * config.barWidth;
          } else {
          }

          var y2 = hSize + 0.5*config.barHeight + _this.series.indexOf(currentItem.id) * (config.barHeight + config.vspacing);


          //var y2 = currentItem.py;

          currentItem.diagonalData = {
            source: { x: x1, y: y1 },
            target: { x: x2, y: y2 }
          };
        });

        if (computeOnly === true) return;

        _this.links.selectAll('.' + _this.data[0].name + '-path')
          .data(_this.data[0].data)
          .enter()
          .append('path')
          .attr('class', function(d) {
            return _this.data[0].name + ' ' +
              d.id + ' ' +
              _this.data[0].name + '-path';
          })
          .attr('d', function(d) {
            return _this.diagonal2(d.diagonalData);
          })
          .style({
            'fill': 'none',
            'stroke': '#CCC',
            'stroke-width': 1
          });

        return;
      }

      var previousCol = _this.data[columnIdx-1];
      var currentCol = _this.data[columnIdx];

      currentCol.data.forEach(function(currentItem) {
        var previousItem = _.find(previousCol.data, function(d) {
          return d.id === currentItem.id;
        });

        var x1 = currentItem.px;
        var y1 = currentItem.py;
        var x2 = previousItem.px;
        var y2 = previousItem.py;

        // Figure out offset based on current and previous
        if (previousCol.type && previousCol.type === 'categorical') {
          x2 += 0;
        } else if (previousCol.type && previousCol.type === 'numeric') {
          x2 += 0;
        } else {
          x2 += config.barWidth;
        }
        currentItem.diagonalData = {
          source: { x: x1, y: y1 },
          target: { x: x2, y: y2 }
        };
      });

      if (computeOnly === true) return;

      _this.links.selectAll('.' + currentCol.name + '-path')
        .data(currentCol.data)
        .enter()
        .append('path')
        .attr('class', function(d) {
          return currentCol.name + ' ' +
            d.id + ' ' +
            currentCol.name + '-path';
        })
        .attr('d', function(d) {
          return _this.diagonal2(d.diagonalData);
        })
        .style({
          'fill': 'none',
          'stroke': '#CCC',
          'stroke-width': 1
        });


    });
  };


  // Experimental
  ParallelPipe.prototype.swapColumn = function( idx ) {
    var _this = this;
    var config = _this.config;
    var size = config.barWidth + config.hspacing;

    var col1 = _this.data[ idx ].name;
    var col2 = _this.data[idx-1].name;

console.log('in swap ', col1 + ' with ' + col2);
    var trans1 = d3.transform(_this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col1;
      }).attr('transform'));

    var trans2 = d3.transform(_this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col2;
      }).attr('transform'));

//console.log(trans1.translate);
//console.log(trans2.translate);

    var tDuration = 1200;


    _this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col2;
      })
      .transition()
      .duration(tDuration)
      .attr('transform', function(d) {
        return _this.translate(trans1.translate[0], trans1.translate[1]);
      });

    _this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col1;
      })
      .transition()
      .duration(tDuration)
      .attr('transform', function(d) {
        return _this.translate(trans2.translate[0], trans2.translate[1]);
      });


    var temp = _this.data[idx];
    _this.data[idx] = _this.data[idx-1];
    _this.data[idx-1] = temp;


    // d3.selectAll('path').remove();
    _this.computeLayout(_this.element);
    _this.renderDataLinks2(_this.element, true);

    var diagonalData = {
      source: { x: 0, y: 0 },
      target: { x: 0, y: 0 }
    };
    d3.selectAll('path')
      .transition()
      .duration(tDuration)
      .attr('d', function(d) {
        return _this.diagonal2(d.diagonalData);
      });

  };


  ParallelPipe.prototype.computeLayout = function( element ) {
    var _this = this;
    var config = _this.config;
    var size = config.barWidth + config.hspacing;

    var hSize = config.histogramHeight + config.histogramPadding;

    _this.data.forEach(function(columnData, columnIdx) {
      var data = columnData.data;

      if (columnData.type && columnData.type === 'categorical') {
        // 1) Find uniques
        var uniqueValues = _.unique(_.pluck(columnData.data, 'value')).sort();

        // 2) Figure out layout constraint
        var gap = (config.chartHeight - hSize) / uniqueValues.length;
        var offset = 0.5 * gap;

        uniqueValues.forEach(function(category, cidx) {
          var filtered = _.filter(columnData.data, function(d) {
            return d.value === category;
          });
          filtered.forEach(function(d) {
            d.px = columnIdx * config.columnSize + 0.5*config.barWidth;
            d.py = hSize + offset + cidx * gap;

          });
        });
      } else if (columnData.type && columnData.type === 'numeric') {
        // FIXME: dupe
        var max = d3.max( _.pluck(columnData.data, 'value'));
        var min = d3.min( _.pluck(columnData.data, 'value'));
        var axisPadding = 2;
        var axisHeight = config.chartHeight - (config.histogramPadding + config.histogramHeight) - 8;
        var scale = d3.scale.linear().domain([0, max]).range([axisHeight, 0]);


        columnData.data.forEach(function(g, gidx) {
          g.px = columnIdx * config.columnSize + 0.5*config.barWidth;
          g.py = hSize + scale(g.value);
        });
      } else {
        /*
        columnData.data = _.sortBy(columnData.data, function(item) {
          return -item.value;
        });
        */
        columnData.data.forEach(function(g, gidx) {
          // Path
          g.px = columnIdx * config.columnSize;
          g.py = hSize + 0.5*config.barHeight + gidx * (config.barHeight + config.vspacing);

          // Bar
          g.bx = 1;
          g.by = gidx * (config.barHeight + config.vspacing);
        });
      }
    });

  };



  // FIXME: Scale histogram and bar
  ParallelPipe.prototype.renderDataBars = function( element ) {
    var _this = this;
    var config = _this.config;

    var links = _this.chart.append('g');

    var size = config.barWidth + config.hspacing;
    var columns = _this.chart.selectAll('parallel-column')
      .data(_this.data)
      .enter()
      .append('g')
      .attr('class', function(d) {
        return 'parallel-column' + ' ' + d.name;
      })
      //.classed('parallel-column', true)
      .attr('transform', function(d, i) {
        return _this.translate( i * size, 1);
      });


    // Summary (Historgram)
    if (config.histogramHeight > 0) {
      columns.append('rect')
        .attr('x', 1)
        .attr('y', function(d) {
          return config.histogramHeight - 0.10 * d.value;
        })
        .attr('width', config.barWidth - 1)
        .attr('height', function(d) {
          return 0.10 * d.value;
        })
        .attr('fill', '#48F');
    }


    // Create columns
    var hSize = config.histogramHeight + config.histogramPadding;
    columns.each(function(columnData, columnIdx) {
      var data = columnData.data;
      var group = d3.select(this).append('g')
        .attr('transform', _this.translate(0, config.histogramHeight+config.histogramPadding))
        .append('g');


      if (columnData.type && columnData.type === 'categorical') {
        // 1) Find uniques
        var uniqueValues = _.unique(_.pluck(columnData.data, 'value')).sort();

        // 2) Figure out layout constraint
        var gap = (config.chartHeight - hSize) / uniqueValues.length;
        var offset = 0.5 * gap;

        uniqueValues.forEach(function(category, cidx) {
          var filtered = _.filter(columnData.data, function(d) {
            return d.value === category;
          });

          group.append('circle')
            .attr('class', function() {
              return _.pluck(filtered, 'id').join(' ');
            })
            .attr('cx', config.barWidth*0.5)
            .attr('cy', offset + cidx * gap)
            .attr('r', 5)
            .style('stroke', '#444')
            .style('fill', '#F9B');
        });

      } else if (columnData.type && columnData.type === 'numeric') {

        var max = d3.max( _.pluck(columnData.data, 'value'));
        var min = d3.min( _.pluck(columnData.data, 'value'));
        var axisPadding = 2;
        var axisHeight = config.chartHeight - (config.histogramPadding + config.histogramHeight) - 8;
        var scale = d3.scale.linear().domain([0, max]).range([axisHeight, 0]);

        group.append('rect')
          .attr('x', config.barWidth * 0.5 - 1)
          .attr('y', -axisPadding)
          .attr('width', 2)
          .attr('height', axisHeight + 2*axisPadding)
          .style('fill', '#777')
          .style('stroke', 'none');

        group.append('text')
          .attr('x',  config.barWidth * 0.5 + 5)
          .attr('y', 0)
          .text(max);

        group.append('text')
          .attr('x',  config.barWidth * 0.5 + 5)
          .attr('y', axisHeight)
          .text(min);

      } else {
        columnData.data.forEach(function(g, gidx) {
          group.append('rect')
            .datum(g)
            .attr('class', g.id + ' ' + 'parallel-column-data' + ' ' + 'outer')
            .attr('x', 1)
            .attr('y',  gidx * (config.barHeight + config.vspacing))
            .attr('width', config.barWidth-1)
            .attr('height', config.barHeight)
            .style({
              fill: '#FFFFFF',
              'fill-opacity': 0,
              stroke: '#BBB'
            });

          group.append('rect')
            .datum(g)
            .attr('class', g.id + ' ' + 'parallel-column-data' + ' ' + 'inner')
            .attr('x', 1)
            .attr('y', gidx * (config.barHeight + config.vspacing))
            .attr('width',  g.value * 0.1)
            .attr('height', config.barHeight)
            .style({
              fill: '#48F',
              stroke: 'none'
            });

        })
      }


    });
  };


  /**
   * Render labels and other text related things
   * NOTE: Assumes that other compoonents are already in place
   */
  ParallelPipe.prototype.renderDataLabels = function( element ) {
    var _this = this;
    var config = _this.config;

    var columns = _this.chart.selectAll('.parallel-column');

    // Column names
    columns.append('text').text(function(d) { 
      return d.name + ((d.type === 'ranked')? ' (ranked)' : ''); 
    });

    console.log('series', _this.series);

    var hist = config.histogramPadding + config.histogramHeight;
    var s = config.vspacing + config.barHeight;

    console.log(hist, s);

    _this.svg.selectAll('.series-label')
      .data(_this.series)
      .enter()
      .append('text')
      .classed('series-label', true)
      .attr('transform', function(d, i) {
         return _this.translate(5, 13 + config.paddingTop + hist + i*s);
      })
      .text(function(d) { return d; });

  };


  /**
   * Render entry point
   */
  ParallelPipe.prototype.render = function( element ) {
    var _this = this;
    var config = _this.config;

    _this.element = element;

    // FIXME - use viewport
    _this.svg = d3.select(element).append('svg').attr('width', config.width).attr('height', config.height);
    _this.vis = _this.svg.append('g').attr('transform', _this.translate(config.margin, config.margin));
    _this.chart = _this.vis.append('g').attr('transform', _this.translate(config.paddingLeft, config.paddingTop));

    // Debugging
    /*
    _this.chart.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', config.chartWidth)
      .attr('height', config.chartHeight)
      .attr('fill', '#EEEEEE');
      */

    _this.links = _this.chart.append('g');

    // Render components
    _this.computeLayout(_this.element);
    _this.renderDataBars(_this.element);
    _this.renderDataLinks2(_this.element, false);
    _this.renderDataLabels(_this.element);  // Goes last !!!


    // Hook up interactions
    _this.svg.selectAll('.parallel-column-data')
      .on('mouseover', function(d, idx) {
        _this.svg.selectAll('.' + d.id).style({
          stroke: '#FF8800',
          'stroke-width': 2
        });

        _this.svg.append('text')
          .attr('class', 'debug')
          .attr('y', config.chartHeight + 15)
          .style('font-size', '0.6rem')
          .text(function() {
            var str = '';
            _this.data.forEach(function(col) {
              var blah = _.find(col.data, function(d2) { return d2.id === d.id; });
              str += col.name + ':' + blah.value + '   ';
            });
            return str;
          });

      })
      .on('mouseout', function(d, idx) {
        _this.svg.selectAll('.' + d.id).style({
          stroke: '#888888',
          'stroke-width': 1
        });

        _this.svg.selectAll('.debug').remove();
      });


    _this.svg.selectAll('circle')
      .on('mouseover', function(d) {

        // FIXME: should bind to data, not class attr
        var classes = d3.select(this).attr('class').split(' ');

        classes.forEach(function(c, idx) {
          _this.svg.selectAll('.' + c).style({
            stroke: '#FF8800',
            'stroke-width': 2
          });

          _this.svg.append('text')
            .attr('class', 'debug')
            .attr('y', config.chartHeight + 15 + 10*idx)
            .style('font-size', '0.6rem')
            .text(function() {
              var str = '';
              _this.data.forEach(function(col) {
                var blah = _.find(col.data, function(d2) { return d2.id === c; });
                str += col.name + ':' + blah.value + '   ';
              });
              return str;
            });

        });
      })
      .on('mouseout', function(d) {

        // FIXME: should bind to data, not class attr
        var classes = d3.select(this).attr('class').split(' ');

        classes.forEach(function(c, idx) {
          _this.svg.selectAll('.' + c).style({
            stroke: '#888888',
            'stroke-width': 1
          });
        })

        _this.svg.selectAll('.debug').remove();
      });


      // test
      d3.select('body').on('keydown', function(d) {
        _this.shiftKey = d3.event.keyCode === 16;
      });
      d3.select('body').on('keyup', function(d) {
        _this.shiftKey = false;
      });
 

      _this.chart.selectAll('.parallel-column').on('click', function(d, i) {
        console.log(_this.shiftKey);
        if (_this.shiftKey == false) {
          var realIndex = _.findIndex(_this.data, function(d2) {
            return d.name === d2.name;
          });
          console.log('clicked',  i, realIndex, d.name);
          if (realIndex > 0) {
            _this.swapColumn(realIndex);
          }
          return;
        }

        var iii = _.findIndex(_this.data, function(d2) {
          return d.name === d2.name;
        });

        var iiiName = _this.data[iii].name;
        var iiiLen = _this.data[iii].data.length - 1;
        var iiiDuration = 1200;

        console.log('before', _.pluck(_this.data[iii].data, 'value'));
        _this.data[iii].data.reverse();
        console.log('after', _.pluck(_this.data[iii].data, 'value'));

        _this.computeLayout();
        _this.renderDataLinks2(_this.element, true);

        _this.chart.selectAll('.parallel-column').filter('.' + iiiName)
          .selectAll('.inner')
          .transition()
          .duration(iiiDuration)
          .attr('y', function(d, i) {
            return d.by;
          });

        _this.chart.selectAll('.parallel-column').filter('.' + iiiName)
          .selectAll('.outer')
          .transition()
          .duration(iiiDuration)
          .attr('y', function(d, i) {
            return d.by;
          });

        d3.selectAll('path')
          .transition()
          .duration(iiiDuration)
          .attr('d', function(d) {
            return _this.diagonal2(d.diagonalData);
          });
      });



  };

  dcc.ParallelPipe = ParallelPipe;
})();

