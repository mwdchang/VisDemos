

(function() {
  'use strict';

  window.dcc = window.dcc || {};

  /*******************************************************************************
  * 
  * TODO: THe arc calculations are based off a circle, this means the height has 
  * to be larger than the width for it to fit end-to-end. Should look into oval based 
  * arcs.
  *******************************************************************************/
  var Arcs = function(data, config) {
    var defaultConfig = {
      // Chart settings
      width: 500,
      height: 600,
      margin: 5,
      paddingTop: 5,
      paddingBottom: 5,
      paddingLeft: 5,
      paddingRight: 5,

      // Mark settings
      groupHeight: 35,
      groupPadding: 30,
      segmentPadding: 3
    }

    // Attrs that can be derived
    config = config || {};
    Object.keys(defaultConfig).forEach(function (key) {
      if (! config.hasOwnProperty(key)) {
        config[key] = defaultConfig[key];
      }
    });

    config.visWidth  = config.width - 2.0 * config.margin;
    config.visHeight = config.height - 2.0 * config.margin;
    config.chartWidth  = config.visWidth - (config.paddingLeft + config.paddingRight);
    config.chartHeight = config.visHeight - (config.paddingTop + config.paddingBottom);

    config.yAnchor = 0.5 * config.chartHeight - 0.5 * config.groupHeight;

    
    // Helpers
    this.radianTop = d3.scale.linear().range([Math.PI/2, 3*Math.PI/2]);
    this.translate = function(x, y) {
      return 'translate(' + x + ',' + y + ')';
    };


    // Data and configuration
    this.data = data;
    this.config = config;

    console.log('configuration', config);


    // DOM and graphics
    this.svg = undefined;
    this.vis = undefined;
    this.chart = undefined;
  };


  Arcs.prototype.computeGroups = function() {
    var _this = this;
    var config = _this.config;
    var results = [];

    // First pass: aggregate subgroups to get group totals 
    var groups = {};
    _this.data.forEach(function(subGroup, subGroupIdx) {
      subGroup.forEach(function(item) {
        if (! groups[item.group]) {
          groups[item.group] = {
            groupId: item.group,
            size: 0,
            segments: []
          };
        }
        groups[item.group].size += item.value;
        groups[item.group].segments.push({
          groupId: item.group,
          subGroupId: subGroupIdx,
          size: item.value
        });
      });
    });
  
    // Flatten: flatten into array to make iteration easier
    Object.keys(groups).forEach(function(key) {
      results.push(groups[key]);
    });

    console.log('results is', results);

    // Figure out how much space can be allocated to reflect data value
    var w = config.chartWidth;
    var totalVolumne = 0;
    results.forEach(function(group) {
      var numSegments = group.segments.length;
      w -= (1 + numSegments) * config.segmentPadding;
      totalVolumne += group.size;
    });
    w -= (1 + results.length) * config.groupPadding;

    _this.scale = d3.scale.linear().domain([0, totalVolumne]).range([0, w]);

  
    // Second pass: compute group and subgroup positions 
    var offset = config.groupPadding;
    results.forEach(function(group) {
      group.startX = offset;
  
      console.log(group.groupId, group.startX);
      
      var segmentOffset = group.startX + config.segmentPadding;
      group.segments.forEach(function(segment) {
        segment.startX = segmentOffset;
        // segmentOffset += segment.size + config.segmentPadding;
        segmentOffset += _this.scale(segment.size) + config.segmentPadding;
        console.log('\t', segment.groupId, segment.subGroupId, segment.startX);
      });

      offset += _this.scale(group.size) +  // FIXME: scale
        config.groupPadding +
        group.segments.length * config.segmentPadding + config.segmentPadding;
    });


    // Assign back to vis
    _this.groupData = results;
  
    //return results;
  };


  Arcs.prototype.computeLinks = function() {
    var _this = this;
    var config = _this.config;
    var uniqueSubGroups = [];
    var segments = [];
    var results = [];


    // Pull out the sub groups and unique group names
    _this.groupData.forEach(function(group) {
      group.segments.forEach(function(segment) {
        var segmentGroup = segment.subGroupId;
        if (uniqueSubGroups.indexOf(segmentGroup) === -1) {
          uniqueSubGroups.push(segmentGroup);
        }
        segments.push(segment);
      });
    });


    // Find arc combinations
    uniqueSubGroups.forEach(function(key) {
      var links = _.filter(segments, function(segment) {
        return segment.subGroupId === key;
      });
      console.log(key, links);

      // No relations to other segments
      if (! links || links.length < 2) {
        return;
      }

      // Calculate the arcs
      // Not efficient, but since we are not dealing with large number of groups, it doesn't really matter...
      links.forEach(function( outer ) {
        links.forEach(function( inner ) {
          // Self
          if (outer.groupId === inner.groupId) {
            return;
          }

          // Avoid redundant arcs
          var exists = _.filter(results, function(item) {
            return (item.from === outer.groupId && item.to === inner.groupId) || 
              (item.from === inner.groupId && item.to === outer.groupId); 
          });

          // Add arc
          results.push({
            from: outer.groupId,
            to: inner.groupId,
            subGroupId: key,
            //offsetX: 0.5 * Math.abs(outer.startX + inner.startX) + 0.5*outer.size,
            offsetX: 0.5 * Math.abs(outer.startX + inner.startX) + 0.5*_this.scale(outer.size),
            radius: 0.5 * Math.abs(outer.startX - inner.startX)
          });

        });
      });
    });



    // De-dupe (1=>2 is the same as 2=>1)
    var unique = [];

    results.forEach(function(link) {
      var tmp = _.some(unique, function(x) {
        console.log('x', x.from, x.to, link.from, link.to);
        return (x.from === link.from && x.to === link.to && x.subGroupId === link.subGroupId ) || 
          (x.from === link.to && x.to === link.from && x.subGroupId === link.subGroupId);
      })
      if (tmp === false) {
        unique.push(link);
      }
    });

    console.log('unique is', unique);


    _this.linkData = results;
    _this.linkData = unique;
    _this.linkData = _.sortBy(_this.linkData, function(d) {
      return d.to;
    });
    //return results;
  };


  Arcs.prototype.renderGroups = function() {
    var _this = this;
    var config = _this.config;

    var d3cat20 = d3.scale.category10();
    function fillColour(idx) {
      return d3cat20(idx);
    }


    _this.svg.selectAll('.data-group')
      .data(_this.groupData)
      .enter()
      .append('rect')
      .attr('class', 'data-group')
      .attr('x', function(d) {
        return d.startX;
      })
      .attr('y', config.yAnchor)
      .attr('width', function(d) {
        return _this.scale(d.size) + d.segments.length * config.segmentPadding + config.segmentPadding;
      })
      .attr('height', function(d) {
        return config.groupHeight;
      })
      .style({
        'fill': '#888888',
        'stroke': '#666666'
      })
      .each(function(d, i) {
        var groupNode = this.parentNode;
        
        // Render label
        d3.select(groupNode).append('text')
          .attr('x', d.startX)
          .attr('y', 90)
          .text('Set ' + d.groupId);
    
        
        // Render subgroups
        var segmentOffset = config.segmentPadding;
        d.segments.forEach(function(segment) {
          d3.select(groupNode).append('rect')
            .attr('class', 'subgroup subgroup-' + segment.subGroupId)
            .attr('x', function() {
              return segment.startX;
            })
            .attr('y', config.yAnchor + config.segmentPadding)
            .attr('width', _this.scale(segment.size))
            .attr('height', config.groupHeight - 2.0 * config.segmentPadding)
            .style({
              'fill': fillColour(+ d.groupId),
              'stroke': '#000',
              'opacity': '0.33'
            })
            .on('mouseover', function() {
              mouseover(segment.subGroupId);
            })
            .on('mouseout', function() {
              mouseout(segment.subGroupId);
            });
        })
      });
  };

  Arcs.prototype.renderLinks = function() {
    var _this = this;
    var config = _this.config;

    var radians = d3.scale.linear().range([Math.PI/2, 3*Math.PI/2]);
    var arc = d3.svg.line.radial()
      .interpolate('basis')
      .tension(0)
      .angle(function(d) { return radians(d); });

    var radians2 = d3.scale.linear().range([-Math.PI/2, Math.PI/2]);
    var arc2 = d3.svg.line.radial()
      .interpolate('basis')
      .tension(0)
      .angle(function(d) { return radians2(d); });


    console.log('link data', _this.linkData);


    _this.svg.selectAll('.data-link')
      .data(_this.linkData)
      .enter()
      .append('path')
      .attr('class', function(d) {
        return 'data-link subgroup-' + d.subGroupId;
      })
      .attr('transform', function(d, i) {
        if (i % 2 == 0) {
          var x = d.offsetX;
          var y = config.yAnchor + config.groupHeight;
          return _this.translate(x, y);
        } else {
          var x = d.offsetX;
          var y = config.yAnchor; 
          return _this.translate(x, y);
        }
      })
      .attr('d', function(d, i) {
        var points = d3.range(0, 10);

        if (i % 2 == 0) {
          radians.domain([0, points.length -1]);
          arc.radius(d.radius);
          return arc(points);
        } else {
          radians2.domain([0, points.length -1]);
          arc2.radius(d.radius);
          return arc2(points);
        }


      })
      .style({
        'fill': 'none',
        'stroke': '#888888',
        'stroke-width': '3',
        'opacity': 0.33
      });

  };


  Arcs.prototype.render = function(element) {
    var _this = this;
    var config = _this.config;
    console.log('confog', config);
    _this.element = element;

    // FIXME: use viewport/viewbox
    _this.svg = d3.select(element).append('svg').attr('width', config.width).attr('height', config.height);
    _this.vis = _this.svg.append('g').attr('transform', _this.translate(config.margin, config.margin));
    _this.chart = _this.vis.append('g').attr('transform', _this.translate(config.paddingLeft, config.paddingTop));


    _this.computeGroups();
    _this.computeLinks();
    _this.renderGroups();
    _this.renderLinks();
  };


  dcc.Arcs = Arcs; 
})();
