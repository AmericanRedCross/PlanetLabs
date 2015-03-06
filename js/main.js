var windowH = $(window).height();
$("#map").height(windowH);
$("#infoWrapper").height(windowH);

var formatAcquiredTime = d3.time.format('%d-%b-%Y, %H:%M UTC');
var formatCommas = d3.format(",");

//planet labs url
var url = "https://api.planet.com/v0/scenes/ortho/";
var key = "";
var auth = "";

// show modal for api key input
$('#key-request').modal(options);

// check if API key works
function keysubmit(){
  $('#input-api-btn').button('loading');
  key = ($('#input-api-key').val());
  auth = "Basic " + btoa(key + ":");
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

var searchBounds = [];

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
    var theseBounds = d3.geo.bounds(e.layer.toGeoJSON());
    searchBounds = [
      [theseBounds[0][1],theseBounds[0][0]],
      [theseBounds[1][1],theseBounds[1][0]]
    ];
    map.fitBounds(searchBounds);
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
    .attr("d", path)
    .on("click", function(d){
      // scroll to corresponding  scene-box
      var selector = ".scene-box[data-id='" + d.id + "']";
      $("#infoWrapper").scrollTo( $(selector), {
        margin: true,
        duration: 1000
      });
    })
    .on("mouseover", function(d){
      // highlight corresponding scene-box
      var selector = ".scene-box[data-id='" + d.id + "']";
      d3.select(selector).classed("highlightBorder", true);
      // show
      d3.select(this).classed("thickBorder", true);
    })
    .on("mouseout", function(d){
      var selector = ".scene-box[data-id='" + d.id + "']";
      d3.select(selector).classed("highlightBorder", false);
      d3.select(this).classed("thickBorder", false);
    });
  function updateScenePaths(){
    mappedScenes.attr("d", path);
  }
  map.on("viewreset", updateScenePaths);
  // remove scenes outside of new bounding box
  mappedScenes.exit().remove();
}

function panToScene(sceneId){
  var thisGeometry = [];
  sceneGroup.selectAll("path").filter(function(d){
    return d.id == sceneId;
  }).each(function(d){
    var bbox = turf.extent(d);
    var leafletBounds = [ [ bbox[1], bbox[0] ], [ bbox[3], bbox[2] ] ];
    map.fitBounds(leafletBounds, { padding: [150, 150]} );
  });
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
    return thisAcquired < minRange || thisAcquired > maxRange;
  }).classed("hidden", true);
  // select mapped extents outside range and hide them
  var sceneExtents = sceneGroup.selectAll("path");
  sceneExtents.classed("hidden", false);
  sceneExtents.filter(function(d){
    var thisAcquired = timestamp(d.properties.acquired);
    return thisAcquired < minRange || thisAcquired > maxRange;
  }).classed("hidden", true);

  var visibleArray = d3.select('#info-scene-list').selectAll('.scene-box').filter(function(d){
    return d3.select(this).classed("hidden") !== true;
  });
  $("#event-scenecount").html(visibleArray[0].length);
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


// fetch and display thumbnail
// ============================
// request thumbnail from planet labs
function getThumbnail(id, url){
  var selector = ".scene-box[data-id='" + id + "']";
  d3.select(selector).append('img').attr('src', 'img/loader.gif');
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.setRequestHeader('Authorization', auth);
  xhr.responseType = 'arraybuffer';
  xhr.onload = function(e) {
      imageSrc = "data:image/png;base64," + base64ArrayBuffer(e.currentTarget.response);
      displayThumbnail(id, imageSrc);
  };
  xhr.send();
}

// display thumbnail on page in the scene-box
function displayThumbnail(id, image64){
  var selector = ".scene-box[data-id='" + id + "']";
  d3.select(selector).select('img').attr('src', image64);
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
          d3.select('#info-scene-count').html(data.features.length + " results" +
            ((data.features.length == 1000) ? " <small>(only the most recent 1,000 scenes listed, reduce size of search area to check for older scenes)</small>" : ""));

          // update listed scenes
          var results = d3.select('#info-scene-list').selectAll('.scene-box')
            .data(data.features, function(d){ return d['id']; });
            results.enter().append('div')
            .html(function(d) { return generateSceneHtml(d); }).classed('scene-box', true)
            .attr("data-id", function(d) { return d.id })
            .on('mouseover', function(d) {
              d3.select(this).classed("highlightBorder", true);
              var thisScene = d3.select(this).attr("data-id");
              sceneGroup.selectAll("path").filter(function(d){
                return d.id == thisScene;
              }).classed("thickBorder", true);
            })
            .on('mouseout', function(d) {
              d3.select(this).classed("highlightBorder", false);
              var thisScene = d3.select(this).attr("data-id");
              sceneGroup.selectAll("path").filter(function(d){
                return d.id == thisScene;
              }).classed("thickBorder", false);
            });
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
          if(data.features.length > 1) {
            $("#info-sort-tools").show();
            setDateSlider(data.features);
          } else {
            $("#info-sort-tools").hide();
          }

          // hide loading gif overlay
          $("#loading-wrapper").fadeOut(500);

        }
      //  >>>>>>>>> if error code
    });
}



function generateSceneHtml(sceneObject) {
  var sceneId = sceneObject.id;
  var acquired = formatAcquiredTime(new Date(sceneObject.properties.acquired));
  var cloudCover = sceneObject.properties.cloud_cover.estimated;
  var sceneHtml = "<div><span class='text-key'>Scene ID:</span> <span class='text-value'>" + sceneId +
    "</span><br><span class='text-key'>Acquired:</span> <span class='text-value'>" + acquired +
    "</span><br><span class='text-key'>Estimated cloud cover:</span> <span class='text-value'>" + cloudCover +
    "</span><br>" +
    "<span class='text-links'>" +
    "<span onClick='panToScene(" + '"' + sceneId + '"' + ");' class='glyphicon glyphicon-search glyphicon-custom clickable text-value' aria-hidden='true'></span> &nbsp;" +
    " | " +
    "<span onClick='getThumbnail(" + '"' + sceneId + '", "' + sceneObject.properties.links.thumbnail  + '"' + ");' class='clickable'>" +
    "<span class='glyphicon glyphicon-picture' aria-hidden='true'></span> &nbsp;load thumbnail</span>" +
    " | " +
    "<a target='_blank' href='" + sceneObject.properties.links.full +
    "'><span class='glyphicon glyphicon-download-alt' aria-hidden='true'></span> &nbsp;Visual</a></span></div>";
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

function zoomOut(){
  map.fitBounds(searchBounds);
}

// on window resize
$(window).resize(function(){
    windowH = $(window).height();
    $("#map").height(windowH);
    $("#infoWrapper").height(windowH);
})

// encode arrayBuffer response to base64
function base64ArrayBuffer(arrayBuffer) {
  var base64    = ''
  var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var bytes         = new Uint8Array(arrayBuffer)
  var byteLength    = bytes.byteLength
  var byteRemainder = byteLength % 3
  var mainLength    = byteLength - byteRemainder

  var a, b, c, d
  var chunk

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
    d = chunk & 63               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4 // 3   = 2^2 - 1

    base64 += encodings[a] + encodings[b] + '=='
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

    base64 += encodings[a] + encodings[b] + encodings[c] + '='
  }

  return base64
}
