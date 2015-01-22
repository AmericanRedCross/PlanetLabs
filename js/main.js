var windowH = $(window).height();
$("#map").height(windowH);
$("#infoWrapper").height(windowH);

var formatAcquiredTime = d3.time.format('%d-%b-%Y, %H:%M UTC');
var formatCommas = d3.format(",");

//planet labs url
var url = "https://api.planet.com/v0/scenes/ortho/";
var key = "";

// show modal for api key input
$('#key-request').modal(options);

// check if API key works
function keysubmit(){
  $('#input-api-btn').button('loading');
  key = ($('#input-api-key').val());
  var auth = "Basic " + btoa(key + ":");
  $.ajax({
    url: url,
    headers: {
      Authorization: auth
    },
    success: function(data) {
      // console.log(data);
      $('#key-request').modal('hide');
    },
    error: function(error) {
      // console.log(error);
      $('#input-api-btn').button('reset');
      $('#input-api-key').val('');
      d3.select('#input-api-key').style('background', '#f2dede').attr("placeholder", "Hmm... that didn't seem to work. Please try entering your API key again.");
    }
  });
}



// create basic leaflet map
// ========================
// tile layer for base map
var hotUrl = 'http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  hotAttribution = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, Tiles from <a href="http://hot.openstreetmap.org/" target="_blank">H.O.T.</a>',
  hotLayer = L.tileLayer(hotUrl, {attribution: hotAttribution}); 
// initialize map w options
var map = L.map('map', {
    layers: [hotLayer],
    center: new L.LatLng(0,0),
    zoom: 2,
    minZoom: 2,
    maxBounds: [[-90,180],[90,-180]]
    // if you track outside of the original world then there are problems with the polygon coordinates
    // when doing the API scene query, setting the map option worldCopyJump: true solved the issue in
    // some instances (when you tracked far enough), but not always. maxBounds seems to do a slightly
    // better job of it
  });

// add leaflet Geocoder search
// ===========================
var geocoder = L.Control.geocoder().addTo(map);
// customize the geocoder result selection function so only centers map and doesn't add a marker
geocoder.markGeocode = function(result) {
      this._map.fitBounds(result.bbox);
};

// leaflet draw functionality
// ==========================
// initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
// layer added after d3 scene extents group for ordering/display purposes

var shapeOptions = {
  clickable: false,
  color: '#7a0177',
  fill: false
};

// set options
var options = {
    draw: {
        polyline: false,
        circle: false,
        marker: false,
        polygon: {
            allowIntersection: false, // Restricts shapes to simple polygons
            shapeOptions: shapeOptions
        },
        rectangle: {
            shapeOptions: shapeOptions
        }
    },
    edit: {
        featureGroup: drawnItems, //REQUIRED!!
        remove: false,
        edit: false

    }
};
// add draw control to map w options
var drawControl = new L.Control.Draw(options);
map.addControl(drawControl);

map.on('draw:created', function (e) {
    var type = e.layerType,
        layer = e.layer;

    // clear previous polygon
    drawnItems.clearLayers();
    // add new polygon to map
    drawnItems.addLayer(layer);
    // use polygon to search scenes from Planet Labs
    searchScenes(e.layer.toGeoJSON());
});


// d3 map overlay for scene boxes
// ==========================
function projectPoint(x, y) {
  var point = map.latLngToLayerPoint(new L.LatLng(y, x));
  this.stream.point(point.x, point.y);
}
var transform = d3.geo.transform({point: projectPoint}),
    path = d3.geo.path().projection(transform);

// initialize the SVG layer for D3 drawn survey points
map._initPathRoot()

// pick up the SVG from the map object
var svg = d3.select("#map").select("svg");
// add leaflet draw layer
map.addLayer(drawnItems);
var sceneGroup = svg.append('g').attr("id", "d3scenes");

function drawSceneBounds(data){
  var sceneData = data;
  var mappedScenes = sceneGroup.selectAll("path").data(sceneData, function(d){ return d['id']; });
  mappedScenes.enter().append("path")
    .attr("class", "scene-default")
    .attr("d",path)
    .on("mouseover", function(d){
      console.log(d);           
    })
    // .on("mouseout", function(d){ 
    //   $('#tooltip').empty();
    // })
  function updateScenePaths(){
    mappedScenes.attr("d", path);
  }
  map.on("viewreset", updateScenePaths);
  // remove scenes outside of new bounding box
  mappedScenes.exit().remove();
}


// date slider
// ===========
// create a new date from a string, return as a timestamp.
function timestamp(str){
    return new Date(str).getTime();   
}
// write the date pretty
var writeDate = d3.time.format('%d-%b-%Y');
function setDate(value){
  $(this).html(writeDate(new Date(+value)));
  rangeChange();
}
function rangeChange(){
  // get date range
  var sliderValArray = $("#date-slider").val();
  var minRange = +sliderValArray[0];
  var maxRange = +sliderValArray[1];
  // select scenes info-boxes outside range and hide them
  var sceneBoxes = d3.select('#info-scene-list').selectAll('.scene-box');
  sceneBoxes.classed("hidden", false);
  sceneBoxes.filter(function(d){
    var thisAcquired = timestamp(d.properties.acquired);
    return thisAcquired <= minRange || thisAcquired >= maxRange;
  }).classed("hidden", true);
  // select mapped extents outside range and hide them
  var sceneExtents = sceneGroup.selectAll("path");
  sceneExtents.classed("hidden", false);
  sceneExtents.filter(function(d){
    var thisAcquired = timestamp(d.properties.acquired);
    return thisAcquired <= minRange || thisAcquired >= maxRange;
  }).classed("hidden", true);

}
// build the slider
function setDateSlider(data){
  var minDate = timestamp(data[0].properties.acquired);
  var maxDate = timestamp(data[0].properties.acquired);
  $.each(data, function(index, scene){
    if(timestamp(scene.properties.acquired) > maxDate){
      maxDate = timestamp(scene.properties.acquired);
    }
    if(timestamp(scene.properties.acquired) < minDate){
      minDate = timestamp(scene.properties.acquired);
    }
  });
  $("#date-slider").noUiSlider({
    range: {
      min: minDate,
      max: maxDate
    },
    // steps of one day
    step: 24 * 60 * 60 * 1000,
    start: [minDate, maxDate],
    // No decimals
    format: wNumb({
      decimals: 0
    }),
    // margin of one day
    margin: 24 * 60 * 60 * 1000
  }, true);

  $("#date-slider").Link('lower').to($("#event-start"), setDate);
  $("#date-slider").Link('upper').to($("#event-end"), setDate);

}





// planet labs API scene search
// ============================
var sortOrder = "";

function searchScenes(aoi){
  $("#loading-wrapper").fadeIn();
  // stringigy the polygon search area drawn to leaflet map
  var intersects = JSON.stringify(aoi);
  // set search parameters
  var params = {
    intersects: intersects,
    order_by: 'acquired desc', // order newest to oldest
    count: 1000, // set number of possible results to maximum
  };
  var auth = "Basic " + btoa(key + ":");
  // request scenes
  $.ajax({
      url: url,
      data: params,
      headers: {
          "Authorization": auth
      },
      success: function(data) {
          // do something with data.features here

          // log number of results displayed
          d3.select('#info-scene-count').html(data.features.length + " results");
          if (data.features.length == 0){
            $("#info-sort-tools").hide();
            // hide loading gif overlay
            $("#loading-wrapper").fadeOut(500);
          } else {

            // if API return limit is reached display note
            if(data.features.length == 1000){
              d3.select('#info-scene-count').html(formatCommas(data.features.length) + " results " +
                "<small>(only the most recent 1,000 scenes listed, reduce size of search area to check for older scenes)</small>");
            }

            // show sort tools
            $("#info-sort-tools").show();

            // update listed scenes
            var results = d3.select('#info-scene-list').selectAll('div')
              .data(data.features, function(d){ return d['id']; });
            results.enter().append('div').html(function(d) { return generateSceneHtml(d); }).classed('scene-box', true);
            results.exit().remove();

            // scenes may be in new and old selection
            // the list is not completey refreshed, only updated
            // so needs to be resorted in descending order
            sortOrder = "desc";
            d3.select('#info-scene-list').selectAll('.scene-box').sort(function(a,b){
              return new Date(b.properties.acquired) - new Date(a.properties.acquired);
            });

            // draw polygons on map using d3
            drawSceneBounds(data.features);
            // set date slider
            setDateSlider(data.features);

            // hide loading gif overlay
            $("#loading-wrapper").fadeOut(500);
          }
      }
      //  >>>>>>>>> if error code
  });
}



function generateSceneHtml(sceneObject) {
  var sceneId = sceneObject.id;
  var acquired = formatAcquiredTime(new Date(sceneObject.properties.acquired));
  var cloudCover = sceneObject.properties.cloud_cover.estimated;
  var sceneHtml = "<span class='text-key'>Scene ID:</span> <span class='text-value'>" + sceneId +
    "</span><br><span class='text-key'>Acquired:</span> <span class='text-value'>" + acquired + 
    "</span><br><span class='text-key'>Estimated cloud cover:</span> <span class='text-value'>" + cloudCover + 
    "</span><br>" +
    "<span class='text-links'>" +
    "<a class='hidden' href='#'><span class='glyphicon glyphicon-map-marker' aria-hidden='true'></span> &nbsp;Identify on map</a>" +
    " | " +
    "<a target='_blank' href='" + sceneObject.properties.links.thumbnail + 
    "'><span class='glyphicon glyphicon-download-alt' aria-hidden='true'></span> &nbsp;thumbnail</a>" +
    " | " +
    "<a target='_blank' href='" + sceneObject.properties.links.full + 
    "'><span class='glyphicon glyphicon-download-alt' aria-hidden='true'></span> &nbsp;GeoTIFF</a></span>" + 
    "<hr>";
  return sceneHtml;
}

function toggleSceneAcquiredOrder(){
  if(sortOrder == "desc"){
    //change to sort asc
    sortOrder = "asc";
    d3.select('#info-scene-list').selectAll('.scene-box').sort(function(a,b){
      return new Date(a.properties.acquired) - new Date(b.properties.acquired);
    });
  } else {
    // change to sort desc
    sortOrder = "desc";
    d3.select('#info-scene-list').selectAll('.scene-box').sort(function(a,b){
      return new Date(b.properties.acquired) - new Date(a.properties.acquired);
    });
  }
}



// on window resize
$(window).resize(function(){
    windowH = $(window).height();
    $("#map").height(windowH);
    $("#infoWrapper").height(windowH); 
})