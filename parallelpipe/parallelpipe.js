(function() {
  'use strict';

  window.dcc = window.dcc || {};

  var ParallelPipe = function( data, config ) {

    var defaultConfig = {
      // Layout
      width: 600,
      height: 180,
      margin: 5,
      paddingTop: 5,
      paddingBottom: 15,
      paddingLeft: 45,
      paddingRight: 5,

      histogramHeight: 40,
      histogramPadding: 5,

      hspacing: 25,
      vspacing: 15,


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



  ParallelPipe.prototype.renderDataLinks = function( element ) {
    var _this = this;
    var config = _this.config;

    var links = _this.chart.append('g')
      .attr('transform', function() {
        return _this.translate(0, config.histogramHeight + config.histogramPadding);
      });

    var items = _.pluck(data[0].data, 'id');
    items.forEach(function(item, itemIdx) {

      var indexList = getIndexList(item, _this.data);
      for (var i=0; i < indexList.length - 1; i++) {

        var x1 = config.barWidth + i * (config.barWidth + config.hspacing);
        var x2 = (i+1) * (config.barWidth + config.hspacing);
        var y1 = (0.5 * config.barHeight) + indexList[i] * (config.barHeight + config.vspacing);
        var y2 = (0.5 * config.barHeight) + indexList[i+1] * (config.barHeight + config.vspacing);

        var diagnoalData = {
          source: { x: x1, y:y1},
          target: { x: x2, y:y2}
        };


        links.append('path')
          .classed(item, true)
          .datum( diagnoalData )
          .attr('d', _this.diagonal2)
          .style({
            'fill': 'none',
            'stroke': '#CCC',
            'stroke-width': 1
          });

        /*
        links.append('line')
          .classed(item, true)
          .attr('x1', x1)
          .attr('y1', y1)
          .attr('x2', x2)
          .attr('y2', y2)
          .attr('stroke-width', 1)
          .attr('stroke', '#888888'); */
      }
    });

  };


  ParallelPipe.prototype.renderDataLinks2 = function( element ) {
    var _this = this;
    var config = _this.config;
    // var links = _this.chart.append('g');

    _this.data.forEach(function(columnData, columnIdx) {

      // TODO: ab-initio
      if (columnIdx === 0) {
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
        } else {
          x2 += config.barWidth;
        }

        var diagonalData = {
          source: { x: x1, y: y1 },
          target: { x: x2, y: y2 }
        };

        _this.links.append('path')
          .classed(currentItem.id, true)
          .datum(diagonalData)
          .attr('d', _this.diagonal2)
          .style({
            'fill': 'none',
            'stroke': '#CCC',
            'stroke-width': 1
          });

      });

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
      .classed('parallel-column', true)
      .attr('transform', function(d, i) {
        return _this.translate( i * size, 1);
      });


    // Summary (Historgram)
    var histogram = columns.append('rect')
      .attr('x', 1)
      .attr('y', function(d) {
        return config.histogramHeight - 0.10 * d.value;
      })
      .attr('width', config.barWidth - 1)
      .attr('height', function(d) {
        return 0.10 * d.value;
      })
      .attr('fill', '#48F');


    // Create columns
    var hSize = config.histogramHeight + config.histogramPadding;
    columns.each(function(columnData, columnIdx) {
      var data = columnData.data;
      var group = d3.select(this).append('g')
        .attr('transform', _this.translate(0, config.histogramHeight+config.histogramPadding))
        .selectAll('.parallel-column-data')
        .data(data)
        .enter().append('g');


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


        //FIXME: dup
        /*
        if (columnIdx > 0) {
          var prev = _this.data[columnIdx-1].data;
          var current = columnData.data;

          current.forEach(function(currentItem) {
            var last = _.find(prev, function(d) {
              return d.id === currentItem.id;
            });
            var x1 = currentItem.px; 
            var y1 = currentItem.py;
            var x2 = last.px; 
            var y2 = last.py;

            var temp = _this.data[columnIdx-1];
            if (temp.type && temp.type === 'categorical') {
              x2 += 0.5 * config.barWidth;
            } else {
              x2 += config.barWidth;
            }


            var diagonalData = {
              source: { x: x1, y:y1},
              target: { x: x2, y:y2}
            };

            links.append('path')
              .classed(currentItem.id, true)
              .datum(diagonalData)
              .attr('d', _this.diagonal2)
              .style({
                'fill': 'none',
                'stroke': '#CCC',
                'stroke-width': 1
              });
          });
        }
        */


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

      } else {

        // Layout - in word space
        group.each(function(g, gidx) {
          // g.px = config.barWidth + (columnIdx) * config.columnSize;
          g.px = columnIdx * config.columnSize;
          g.py = hSize + 0.5*config.barHeight + gidx * (config.barHeight + config.vspacing);
        });


        /*
        if (columnIdx > 0) {
          var prev = _this.data[columnIdx-1].data;
          var current = columnData.data;

          current.forEach(function(currentItem) {
            var last = _.find(prev, function(d) {
              return d.id === currentItem.id;
            });
            var x1 = currentItem.px; 
            var y1 = currentItem.py;
            var x2 = last.px; 
            var y2 = last.py;

            var temp = _this.data[columnIdx-1];
            if (temp.type && temp.type === 'categorical') {
              x2 += 0;
            } else {
              x2 += config.barWidth;
            }


            var diagonalData = {
              source: { x: x1, y:y1},
              target: { x: x2, y:y2}
            };

            links.append('path')
              .classed(currentItem.id, true)
              .datum(diagonalData)
              .attr('d', _this.diagonal2)
              .style({
                'fill': 'none',
                'stroke': '#CCC',
                'stroke-width': 1
              });
          });
        }
        */


        group.append('rect')
          .attr('class', function(d) {
            return d.id + ' ' + 'parallel-column-data';
          })
          .attr('x', 1)
          .attr('y', function(d, i) {
            return i * (config.barHeight + config.vspacing);
          })
          .attr('width', config.barWidth-1)
          .attr('height', config.barHeight)
          .style({
            fill: '#FFFFFF',
            'fill-opacity': 0,
            stroke: '#BBB'
          });
        group.append('rect')
          .attr('class', function(d) {
            return d.id + ' ' + 'parallel-column-data';
          })
          .attr('x', 1)
          .attr('y', function(d, i) {
            return i * (config.barHeight + config.vspacing);
          })
          .attr('width', function(d) {
            return d.value * 0.1;
          })
          .attr('height', config.barHeight)
          .style({
            fill: '#48F',
            stroke: 'none'
          });

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
    columns.append('text').text(function(d) { return d.name; });

    var series = _.pluck(_this.data[0].data, 'id');
    console.log('series', series);

    var hist = config.histogramPadding + config.histogramHeight;
    var s = config.vspacing + config.barHeight;

    console.log(hist, s);

    _this.svg.selectAll('.series-label')
      .data(series)
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
    _this.chart.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', config.chartWidth)
      .attr('height', config.chartHeight)
      .attr('fill', '#EEEEEE');

    _this.links = _this.chart.append('g');

    // Render components
    _this.renderDataBars(_this.element);
    _this.renderDataLinks2(_this.element);
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
          .style('font-size', '1rem')
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
            .attr('y', config.chartHeight + 15 + 15*idx)
            .style('font-size', '1rem')
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


  };


  /**
   * Given an id, find its position across all the data columns
   */
  function getIndexList(id, data) {
    var result = [];
    data.forEach(function(column) {
      var idx = _.findIndex(column.data, function(item) {
        return item.id === id;
      });
      result.push(idx);
    });
    return result;
  }


  dcc.ParallelPipe = ParallelPipe;

})();

