/******************************************************************************
*
* Interactive bar chart
*
* Usage:
*   var data = [3, 6, 8, 3];
*   var bar = new BarChart(data, data, null);
*   bar.render( d3.select('#canvas_id'))
*
******************************************************************************/
(function() {
'use strict';

window.dcc = window.dcc || {};

var BarChart = function( originalData, currentData, config ) {
var defaultConfig = {
title: 'Bar Chart',
colourOutline: '#505050',
colourFill: '#7799EE',

barSpacing: 1.5,
width: 370,
height: 120,
margin: 5,
padding: 30,
paddingLeft: 40,
paddingRight: 40,
paddingTop: 30,
paddingBottom: 20,

updateTransitionTime: 600,
selectTransitionTime: 150,

selectedAlpha: 1.0,
unSelectedAlpha: 0.1,
axis: 'dynamic',
axisLabel: '',
maxDisplay: -1,

mapFunc: function( data, idx ) {
return {
key: idx,
value: data
};
},
totalFunc: function( data ) {
return d3.sum(data, function(d) { return d.value; });
},
clickFunc: function() {
d3.event.stopPropagation();
},
labelFunc: function(d) {
return d.key;
}
};

config = config || {};

Object.keys(defaultConfig).forEach(function (key) {
if (! config.hasOwnProperty(key)) {
config[key] = defaultConfig[key];
}
});


if (config.maxDisplay < 0) {
config.usePager = false;
config.maxDisplay = originalData.length;
} else {
config.usePager = true;
}

/*
config.usePager = false;
if (config.maxDisplay < originalData.length) {
config.userPager = true;
}
*/


// -------------------------------------------------------------------------
// | <----------------------------- margin ------------------------------> |
// | <- margin -> | <--------------- vis -----------------> | <- margin -> |
// | <- margin -> |                                         | <- margin -> |
// | <- margin -> | <- padding L-> | chart | <- padding R-> | <- margin -> |
// | <- margin -> |                                         | <- margin -> |
// | <----------------------------- margin ------------------------------> |
// -------------------------------------------------------------------------
config.visWidth  = config.width - 2.0 * config.margin;
config.visHeight = config.height - 2.0 * config.margin;
config.chartWidth  = config.visWidth - (config.paddingLeft + config.paddingRight);
config.chartHeight = config.visHeight - (config.paddingTop + config.paddingBottom);


//            __________           __________                 __________
// | <- s -> | <- B1 -> | <- s -> | <- B2 -> | ... | <- s -> | <- BN -> |
// ----------------------------------------------------------------------
config.barWidth = (config.chartWidth - config.maxDisplay * config.barSpacing) / (config.maxDisplay);
// config.barWidth = (config.chartWidth - originalData.length * config.barSpacing) / (originalData.length);
config.barWidth = Math.max( config.barWidth, 1.0 );

// Helper functions
this.translate = function(x, y) {
return 'translate(' + x + ',' + y + ')';
};


this.originalData = originalData.map(config.mapFunc); // Normalize
this.currentData = currentData.map(config.mapFunc);   // Normalize

this.currentPage = 0;

this.total = config.totalFunc(this.originalData);
this.highlightedItems = {};

this.config = config;
this.rescaleAxis(this.originalData);
};




////////////////////////////////////////////////////////////////////////////////
//
// Initialize SVG canvas and render the chart.
// The DOM is structure as follows:
//
// vis
//   -> axis
//   -> chart
//      -> control_group (1 .. N)
//        -> control_group_rect
//        -> bar_original
//        -> bar_current
//
// Data is bound to control_group, which uses control_group_rect as a hidden elem
// to handle extremely variances, which make interactions difficult.
//
////////////////////////////////////////////////////////////////////////////////
BarChart.prototype.render = function( element ) {
var _this = this, config = _this.config;

var title;
this.element = element;


_this.svg = d3.select(element).append('svg').attr('width', config.width).attr('height', config.height);

_this.vis = _this.svg.append('g').attr('transform', _this.translate(config.margin, config.margin));
_this.vis.append('rect')
.attr('width', config.visWidth)
.attr('height', config.visHeight)
.style('fill', '#FFFFFF');

_this.chart = _this.vis.append('g').attr('transform', _this.translate(config.paddingLeft, config.paddingTop));
_this.chart.append('rect')
.attr('width', config.chartWidth)
.attr('height', config.chartHeight)
.style('fill', '#FFFFFF');

title = _this.vis.append('g')
.attr('transform', _this.translate(config.paddingLeft + 0.5*config.chartWidth, 11))
.append('text')
.attr('text-anchor', 'middle')
.classed('graph_title', true)
.text(config.title);


if (config.usePager === true) {
var pages = Math.ceil( _this.originalData.length / config.maxDisplay );

_this.pager = _this.vis.append('g')
.attr('transform', _this.translate(config.paddingLeft + 0.5*config.chartWidth, 24))
.append('text')
.attr('text-anchor', 'middle')
.attr('letter-spacing', 5)
.style('font-weight', 300)
.style('font-size', '0.65rem');

for (var pidx = 0; pidx < pages; pidx++) {
_this.pager.append('tspan')
.datum({page: pidx});
}

_this.pager.selectAll('tspan')
.text(function(d) {
return 1 + d.page;
})
.on('click', function(d) {
_this.currentPage = d.page;
_this.renderChart();
_this.updatePager();
});

_this.updatePager();
}


_this.vis.append('g')
.classed('axis', true)
.classed('bar_axis', true)
.attr('transform', _this.translate(config.paddingLeft, config.paddingTop))
.call(_this.yAxis);

// This will do for x-axis for now
_this.vis.append('g')
.classed('axis', true)
.attr('transform', _this.translate(config.paddingLeft, config.paddingTop + config.chartHeight))
.append('path')
.attr('stroke-width', 1)
.attr('d', 'M0,0L' + (config.chartWidth + 10) + ',0');

_this.vis.append('g')
.attr('transform', _this.translate(5, config.paddingTop + config.chartHeight) + ' rotate(-90)')
.append('text')
.classed('axis-label', true)
.text(config.axisLabel);


// Render data
_this.renderChart();
};


//////////////////////////////////////////////////////////////////////////////// 
// Renders data
//////////////////////////////////////////////////////////////////////////////// 
BarChart.prototype.renderChart = function() {
var _this = this, config = _this.config;
var controlGroup;

// Need to create a copy because splice modifies the original
var renderData = _.clone(_this.originalData).splice(_this.currentPage*config.maxDisplay, config.maxDisplay);

_this.chart.selectAll('*').remove();

controlGroup = _this.chart.selectAll('g')
.data(renderData)
.enter()
.append('g')
.attr('class', 'control_group')
.classed('graph_interactive', true)
.attr('transform', function(d, idx) {
return _this.translate(1 + idx * (config.barWidth + config.barSpacing), 0);
});

var cMap = {};
_this.currentData.forEach(function(d) {
cMap[d.key] = d;
});

// Build blank bar to capture events, this is useful for selecting near-zero items
controlGroup.append('rect')
.attr('class', 'control_group_rect')
.attr('x', 0)
.attr('y', config.chartHeight*0.5)
.attr('width', config.barWidth)
//.attr('height', config.chartHeight)
.attr('height', 0.5*config.chartHeight)
.attr('stroke', 'None')
.style('fill', '#FFFFFF')
.style('opacity', 0.0);


// User interaction
controlGroup.on('mouseover', function(d) {
var cval = d3.select(this).select('.bar_current').datum();

controlGroup.selectAll('.bar_current')
.transition()
.duration(config.selectTransitionTime)
.style('opacity', function(n) {
if ( _this.highlightedItems[n.key] || n.key === d.key) {
return config.selectedAlpha;
} else {
return config.unSelectedAlpha;
}
});

_this.chart.append('rect')
.classed('debug', true)
.attr('x', 0)
.attr('y', _this.yScale(cval.value))
.attr('height', 0.5)
.attr('width', config.chartWidth)
.style('fill', '#888');

_this.chart.append('circle')
.classed('debug', true)
.attr('cx', 0)
.attr('cy', _this.yScale(cval.value))
.attr('r', 2.5)
.style('fill', '#F88');

var text = _this.vis.append('g').attr('class', 'debug')
.attr('transform', _this.translate(config.paddingLeft,
config.paddingTop + config.chartHeight + config.paddingBottom - 7))
.append('text');

text.append('tspan')
.classed('debug', true)
.style('font-weight', 600)
.text(d.key);

text.append('tspan')
.classed('debug', true)
.attr('x', 0)
.attr('y', 11)
.text(d.value);

//.text(config.labelFunc(d));
});


controlGroup.on('mouseout', function(d) {
if (! _this.highlightedItems[d.key]) {
d3.select(this).select('.bar_current').style('fill', d.colourFill);
}

controlGroup.selectAll('.bar_current')
.transition()
.duration(config.selectTransitionTime)
.style('opacity', function(n) {
if ( _.isEmpty(_this.highlightedItems) || _this.highlightedItems[n.key]) {
return config.selectedAlpha;
} else {
return config.unSelectedAlpha;
}
});

_this.svg.selectAll('.debug').remove();
});
controlGroup.on('click', config.clickFunc);


// Build original values
if (config.axis === 'static') {
_this.rescaleAxis(_this.originalData);

controlGroup.each(function(d) {
d3.select(this)
.append('rect')
.attr('class', 'bar_original')
.attr('x', 0)
.attr('y', _this.yScale(d.value))
.attr('ry', 1)
.attr('width', config.barWidth)
.attr('height', (config.chartHeight - _this.yScale(d.value)))
.attr('stroke', config.colourOutline)
.attr('stroke-width', 0.5)
.style('fill', 'None')
.style('opacity', 0.3);
});
} else {
_this.rescaleAxis(_this.currentData);
}

// Build current values
controlGroup.each(function(d) {
if ( ! cMap[d.key]) {
d.value = 0;
} else {
d.value = cMap[d.key].value;
}

d3.select(this)
.append('rect')
.attr('class', 'bar_select_indicator')
.attr('x', 1)
.attr('y', config.chartHeight+3)
.attr('width', config.barWidth-1)
.attr('height', 3)
.style('stroke', 'none')
.style('fill', '#FF8833')
.style('opacity', function() {
if ( _this.highlightedItems[d.key]) {
return config.selectedAlpha;
} else {
return config.unSelectedAlpha;
}
});


d3.select(this)
.append('rect')
.attr('class', 'bar_current')
.attr('x', 0)
.attr('y', _this.yScale(d.value))
.attr('ry', 1)
.attr('width', config.barWidth)
.attr('height', (config.chartHeight - _this.yScale(d.value)))
.style('fill', d.colourFill)
.style('opacity', function(d) {
if (_.isEmpty(_this.highlightedItems) || _this.highlightedItems[d.key]) {
return config.selectedAlpha;
} else {
return config.unSelectedAlpha;
}
});

});
};


BarChart.prototype.updatePager = function() {
var _this = this;

_this.pager.selectAll('tspan')
.filter(function(d) {
return d.page !== _this.currentPage;
})
.style('cursor', 'pointer')
.style('font-weight', 300)
.on('mouseover', function() {
d3.select(this).style('font-weight', 600);
})
.on('mouseout', function() {
d3.select(this).style('font-weight', 300);
});

_this.pager.selectAll('tspan')
.filter(function(d) {
return d.page === _this.currentPage;
})
.attr('text-decoration', 'none')
.style('cursor', 'auto')
.style('font-weight', 600)
.on('mouseover', null)
.on('mouseout', null);
};



////////////////////////////////////////////////////////////////////////////////
// Rescale the y-axis scale based on a data series
////////////////////////////////////////////////////////////////////////////////
BarChart.prototype.rescaleAxis = function(data) {
var _this = this, config = _this.config, max = 1, page = _this.currentPage;

data.forEach(function(d, i) {
var inFocus = (i >= page * config.maxDisplay && i < (page+1) * config.maxDisplay);
if (inFocus && max < d.value) {
max = d.value;
}
});
_this.yScale = d3.scale.linear().domain([max, 0]).range([0, config.chartHeight]);
_this.yAxis = d3.svg.axis().scale(_this.yScale).orient('left').ticks(2).tickSize(2).tickFormat(d3.format('s'));
d3.select(_this.element).select('.bar_axis').transition().duration(config.updateTransitionTime).call(_this.yAxis);
};



////////////////////////////////////////////////////////////////////////////////
// Update
////////////////////////////////////////////////////////////////////////////////
BarChart.prototype.update = function( currentData ) {
this.currentData = currentData.map(this.config.mapFunc);
var _this = this;
var config = _this.config;

var cMap = {};
_this.currentData.forEach(function(d) {
cMap[d.key] = d;
});


if (config.axis === 'dynamic') {
_this.rescaleAxis(_this.currentData);
if (config.usePager) {
_this.updatePager();
}
}

d3.select(this.element)
.selectAll('.control_group')
.each(function(d) {

// update
if (cMap[d.key]) {
d.value = cMap[d.key].value;
} else {
d.value = 0;
}

// display
d3.select(this)
.select('.bar_current')
.transition()
.duration(config.updateTransitionTime)
.attr('y', _this.yScale(d.value))
.attr('height', function(d) { return config.chartHeight - _this.yScale(d.value); });
});
};


BarChart.prototype.setHightlight = function( keys ) {
var _this = this;

// Update
_this.highlightedItems = {};
keys.forEach(function(key) {
_this.highlightedItems[key] = 1;
});
_this.renderChart();
};

BarChart.prototype.reset = function() {
var _this = this;
var config = _this.config;

_this.highlightedItems = {};
d3.selectAll('.control_group')
.each(function(d) {
d3.select('.control_group_rect').style('fill', 'none').style('opacity', 0);
d3.select('.bar_current').style('fill', d.colourFill).style('opacity', config.selectedAlpha);
});
};

BarChart.prototype.destroy = function() {
// Attempt to free up resources
this.currentData = null;
this.originalData = null;
d3.select(this.element).remove();
};


dcc.BarChart = BarChart;
})();
