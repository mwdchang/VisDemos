/*******************************************************************************
* A variant on parallel coordinate visualization; adding suport for ranked as
* well as categorical data.
*
* Column Types:
*  - numeric: is a numeric value and shown as points on an axis scale
*  - ranked: is numeric, but is rendered as histogram and arranged in specified order (assume to be sorted)
*  - categorical: categorical data, this is grouped/merged to show common data points sharing common categories
*
* Method summary
*  - render
*  - renderDataPoints
*  - renderDataLinks
*  - computeLinks
*  - computeLayout
*  - setInteractions
*  - swapColumn
*  - reverseColumnOrder
*  - highlight
*  - resetHighlight
*  - query
*  - resetAll
*
* note: computeLinks and computeLayout must be called before any rendering
*
********************************************************************************/

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
      paddingLeft: 55,
      paddingRight: 5,

      //histogramHeight: 40,
      //histogramPadding: 5,

      histogramHeight: 0,
      histogramPadding: 10,

      hspacing: 25,
      vspacing: 10,

      // Colours
      defaultPathColour: '#888888',
      defaultBarOutlineColour: '#888888',
      defaultBarColour: '#888888',

      // Animation, in millis
      swapDuration: 1200,
      reverseDuration: 1200,


      // Callback
      clickFunc: function() {}
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
    config.axisHeight = config.chartHeight - (config.histogramPadding + config.histogramHeight);
    console.log('parallel coord config', config);

    this.data = data;
    this.config = config;
    this.svg = undefined;
    this.vis = undefined;
    this.chart = undefined;



    this.series = _.pluck(this.data[0].data, 'id').sort();

    this.seriesColours = d3.scale.category20();

    this.getColour = function(seriesName) {
      var idx = _.indexOf(this.series, seriesName);
      return this.seriesColours( idx % this.series.length );
    };

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



  ParallelPipe.prototype.computeLinks = function() {
    var _this = this;
    var config = _this.config;
    var hSize = config.histogramHeight + config.histogramPadding;

    _this.data.forEach(function(columnData, columnIdx) {
      // Ab Initio
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
          currentItem.diagonalData = {
            source: { x: x1, y: y1 },
            target: { x: x2, y: y2 }
          };
        });
      } else {
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
            x2 += config.barWidth+1; // +1 Just to make things look nicer
          }
          currentItem.diagonalData = {
            source: { x: x1, y: y1 },
            target: { x: x2, y: y2 }
          };
        });
      }
    });
  };


  ParallelPipe.prototype.renderDataLinks = function() {
    var _this = this;
    var config = _this.config;
    var hSize = config.histogramHeight + config.histogramPadding;

    _this.data.forEach(function(columnData, columnIdx) {

      // Ab-initio
      if (columnIdx === 0) {
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
            'stroke': config.defaultPathColour,
            'stroke-width': 1
          });
      } else {
        _this.links.selectAll('.' + _this.data[columnIdx].name + '-path')
          .data(_this.data[columnIdx].data)
          .enter()
          .append('path')
          .attr('class', function(d) {
            return _this.data[columnIdx].name + ' ' +
              d.id + ' ' +
              _this.data[columnIdx].name + '-path';
          })
          .attr('d', function(d) {
            return _this.diagonal2(d.diagonalData);
          })
          .style({
            'fill': 'none',
            'stroke': config.defaultPathColour,
            'stroke-width': 1
          });
      }
    });
  };


  
  // Experimental
  // 2 for exact match, 3 for matching range
  ParallelPipe.prototype.query = function() {
    var _this = this;
    var matchedSeries = [];

    if (arguments.length < 2) {
      return;
    }

    var colname = arguments[0];
    var col = _.find(_this.data, function(d) {
      return d.name === colname;
    });

    if (arguments.length === 2) {
      var val = arguments[1];

      col.data.forEach(function(d) {
        if (d.value === val) {
          matchedSeries.push(d.id);
        }
      });

    } else if (arguments.length === 3) {
      var start = arguments[1];
      var end = arguments[2];

      col.data.forEach(function(d) {
        if (d.value >= start && d.value <= end) {
          matchedSeries.push(d.id);
        }
      });
    }

    _this.series.forEach(function(seriesName) {
      _this.resetHighlight(seriesName); 
    });

    matchedSeries.forEach(function(seriesName) {
      _this.highlight(seriesName); 
    });


  };



  ParallelPipe.prototype.highlight = function(seriesName) {
    var _this = this;
    var config = _this.config;

    _this.chart.selectAll('.'+seriesName)
      .style({
        // 'stroke': '#FF8800',
        'stroke': _this.getColour(seriesName),
        'stroke-width': 3
      });

    _this.svg.selectAll('text').filter('.'+seriesName)
      .style({
        'fill': _this.getColour(seriesName)
      });

  };


  ParallelPipe.prototype.resetAll = function() {
    var _this = this;
    _this.series.forEach(function(seriesName) {
      _this.resetHighlight(seriesName); 
    });
  };


  ParallelPipe.prototype.resetHighlight = function(seriesName) {
    var _this = this;
    var config = _this.config;

    _this.chart.selectAll('.'+seriesName)
      .style({
        'stroke': config.defaultPathColour,
        'stroke-width':  1
      });

    _this.svg.selectAll('text').filter('.'+seriesName)
      .style({
        'fill': ''
      });

  };


  // Experimental
  ParallelPipe.prototype.reverseColumnOrder = function( idx ) {
    var _this = this;
    var config = _this.config;

    var name = _this.data[idx].name;

    if (_this.data[idx].type !== 'ranked') {
      return;
    }

    _this.data[idx].data.reverse();
    _this.computeLayout();
    _this.computeLinks();

    _this.chart.selectAll('.parallel-column').filter('.' + name)
      .selectAll('.inner')
      .transition()
      .duration(config.reverseDuration)
      .attr('y', function(d, i) {
        return d.by;
      });

    _this.chart.selectAll('.parallel-column').filter('.' + name)
      .selectAll('.outer')
      .transition()
      .duration(config.reverseDuration)
      .attr('y', function(d, i) {
        return d.by;
      });

    d3.selectAll('path')
      .transition()
      .duration(config.reverseDuration)
      .attr('d', function(d) {
        return _this.diagonal2(d.diagonalData);
      });

  };


  // Experimental
  ParallelPipe.prototype.swapColumn = function( idx1, idx2 ) {
    var _this = this;
    var config = _this.config;
    var size = config.barWidth + config.hspacing;

    if (idx1 < 0 || idx2 < 0 || idx1 === idx2 ) {
      return; 
    }

    var col1 = _this.data[ idx1 ].name;
    var col2 = _this.data[ idx2 ].name;

console.log('in swap ', col1 + ' with ' + col2);
    var trans1 = d3.transform(_this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col1;
      }).attr('transform'));

    var trans2 = d3.transform(_this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col2;
      }).attr('transform'));


    _this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col2;
      })
      .transition()
      .duration(config.swapDuration)
      .attr('transform', function(d) {
        return _this.translate(trans1.translate[0], trans1.translate[1]);
      });

    _this.chart.selectAll('.parallel-column')
      .filter(function(d) {
        return d.name === col1;
      })
      .transition()
      .duration(config.swapDuration)
      .attr('transform', function(d) {
        return _this.translate(trans2.translate[0], trans2.translate[1]);
      });


    var temp = _this.data[idx1];
    _this.data[idx1] = _this.data[idx2];
    _this.data[idx2] = temp;

    _this.computeLayout();
    _this.computeLinks();

    var diagonalData = {
      source: { x: 0, y: 0 },
      target: { x: 0, y: 0 }
    };
    d3.selectAll('path')
      .transition()
      .duration(config.swapDuration)
      .attr('d', function(d) {
        return _this.diagonal2(d.diagonalData);
      });

  };


  ParallelPipe.prototype.computeLayout = function() {
    var _this = this;
    var config = _this.config;
    var size = config.barWidth + config.hspacing;

    var hSize = config.histogramHeight + config.histogramPadding;

    _this.data.forEach(function(columnData, columnIdx) {
      var data = columnData.data;

      // Calculate maximum and minimum values for scaling
      if (['ranked', 'numeric'].indexOf(columnData.type) >= 0) {
        if (! columnData.hasOwnProperty('max')) {
          columnData.max = d3.max( _.pluck(columnData.data, 'value'));
        }
        if (! columnData.hasOwnProperty('min')) {
          columnData.min = d3.min( _.pluck(columnData.data, 'value'));
        }
      }

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
        var scale = d3.scale.linear().domain([columnData.min, columnData.max]).range([config.axisHeight, 0]);
        columnData.data.forEach(function(g, gidx) {
          g.px = columnIdx * config.columnSize + 0.5*config.barWidth;
          g.py = hSize + scale(g.value);
        });
      } else {
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



  // FIXME: Scale histogram
  ParallelPipe.prototype.renderDataPoints = function() {
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
      .attr('transform', function(d, i) {
        return _this.translate( i * size, 0);
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

          // Experimental
          group.append('text')
            .attr('text-anchor', 'end')
            .attr('x', config.barWidth*0.5 - 5)
            .attr('y', offset + cidx * gap)
            .text(category);


        });

      } else if (columnData.type && columnData.type === 'numeric') {

        // Scale
        group.append('rect')
          .attr('x', config.barWidth * 0.5 - 1)
          .attr('y', -1)
          .attr('width', 2)
          .attr('height', config.axisHeight+2)
          .style('fill', '#777')
          .style('stroke', 'none');

        group.append('text')
          .attr('x',  config.barWidth * 0.5 + 5)
          .attr('y', 0)
          .text(columnData.max);

        group.append('text')
          .attr('x',  config.barWidth * 0.5 + 5)
          .attr('y', config.axisHeight)
          .text(columnData.min);

      } else {
        var scale = d3.scale.linear().domain([columnData.min, columnData.max]).range([0, config.barWidth]);

        // Draw scale
        group.append('rect')
          .attr('x', 1)
          .attr('y', config.chartHeight-1)
          .attr('height', 1)
          .attr('width', config.barWidth)
          .style('stroke', '#777');
          
        group.append('text')
          .attr('x', 5)
          .attr('y', config.chartHeight+9)
          .attr('text-anchor', 'end')
          .text(columnData.min);

        group.append('text')
          .attr('x', config.barWidth-5)
          .attr('y', config.chartHeight+9)
          .attr('text-anchor', 'start')
          .text(columnData.max);


        columnData.data.forEach(function(g, gidx) {

          // Draw bar outline
          group.append('rect')
            .datum(g)
            .attr('class', g.id + ' ' + 'parallel-column-data' + ' ' + 'outer')
            .attr('x', 1)
            .attr('y',  gidx * (config.barHeight + config.vspacing))
            .attr('width', config.barWidth)
            .attr('height', config.barHeight)
            .style({
              'fill': '#FFFFFF',
              'fill-opacity': 0,
              stroke: config.defaultBarOutlineColour
            });

          // Draw bar
          group.append('rect')
            .datum(g)
            .attr('class', g.id + ' ' + 'parallel-column-data' + ' ' + 'inner')
            .attr('x', 1)
            .attr('y', gidx * (config.barHeight + config.vspacing))
            .attr('width',  scale(g.value))
            .attr('height', config.barHeight)
            .style({
              fill: config.defaultBarColour,
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
  ParallelPipe.prototype.renderDataLabels = function() {
    var _this = this;
    var config = _this.config;

    var columns = _this.chart.selectAll('.parallel-column');

    // Column names
    columns.append('text').text(function(d) {
      return d.name + ((d.type === 'ranked')? ' (ranked)' : '');
    });

    var hist = config.histogramPadding + config.histogramHeight;
    var s = config.vspacing + config.barHeight;

    _this.svg.selectAll('.series-label')
      .data(_this.series)
      .enter()
      .append('text')
      .attr('class', function(d) {
        return d + ' ' + 'series-label';
      })
      .attr('transform', function(d, i) {
        return _this.translate(1, config.barHeight + config.paddingTop + hist + i*s);
      })
      .attr('font-size', function(d) {
        return config.barHeight * 0.75;
      })
      .text(function(d) { return d; })
      .on('mouseover', function(d) {
        _this.highlight(d);
      })
      .on('mouseout', function(d) {
        _this.resetHighlight(d);
      });
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
    _this.computeLayout();
    _this.computeLinks();
    _this.renderDataPoints();
    _this.renderDataLinks();
    _this.renderDataLabels();  // Goes last !!!
  };



  ParallelPipe.prototype.setInteractions = function() {
    var _this = this;
    var config = _this.config;

    // Hook up interactions
    _this.svg.selectAll('.parallel-column-data')
      .on('mouseover', function(d, idx) {
        _this.highlight(d.id);

        /*
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
          */

      })
      .on('mouseout', function(d, idx) {
        _this.resetHighlight(d.id);
        _this.svg.selectAll('.debug').remove();
      });


    _this.svg.selectAll('circle')
      .on('mouseover', function(d) {

        // FIXME: should bind to data, not class attr
        var classes = d3.select(this).attr('class').split(' ');

        classes.forEach(function(c, idx) {
          _this.highlight(c);

          /*
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
            */

        });
      })
      .on('mouseout', function(d) {

        // FIXME: should bind to data, not class attr
        var classes = d3.select(this).attr('class').split(' ');

        classes.forEach(function(c, idx) {
          _this.resetHighlight(c);
        });

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

        var realIndex = _.findIndex(_this.data, function(d2) {
          return d.name === d2.name;
        });

        if (_this.shiftKey == false) {
          if (realIndex > 0) {
            _this.swapColumn(realIndex, realIndex-1);
          }
        } else {
          _this.reverseColumnOrder(realIndex);
        }
      });

  };

  // Register onto namespace
  dcc.ParallelPipe = ParallelPipe;
})();

