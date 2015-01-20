var windowH = $(window).height();
$("#map").height(windowH);
$("#infoWrapper").height(windowH);

var formatAcquiredTime = d3.time.format('%d-%b-%Y, %H:%M UTC');

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

// add Geocoder
// ============
var geocoder = L.Control.geocoder().addTo(map);
// customize the geocoder result selection function so only centers map and doesn't add a marker
geocoder.markGeocode = function(result) {
      this._map.fitBounds(result.bbox);
};

// draw functionality
// ==================
// initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
// set options
var options = {
    draw: {
        polyline: false,
        circle: false,
        marker: false,
        polygon: {
            allowIntersection: false // Restricts shapes to simple polygons
        },
        rectangle: {
            shapeOptions: {
                clickable: false
            }
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



// planet labs API scene search
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
          // update listed scenes
          var results = d3.select('#info-scene-list').selectAll('div')
            .data(data.features, function(d){ return d['id']; });
          results.enter().append('div').html(function(d) { return generateSceneHtml(d); }).classed('scene-box', true);
          results.exit().remove();

          $("#loading-wrapper").fadeOut(500);

            // need to sort them

            //  >>>>>>>>> draw all polygons on map using d3

            //  >>>>>>>>> close loading box

      }
      //  >>>>>>>>> if error code
  });
}

function generateSceneHtml(sceneObject) {
  var sceneId = sceneObject.id;
  var acquired = formatAcquiredTime(new Date(sceneObject.properties.acquired));
  var sceneHtml = "<span class='text-key'>Scene ID:</span> <span class='text-value'>" + sceneId +
    "</span><br><span class='text-key'>Acquired:</span> <span class='text-value'>" + acquired + "</span><hr>";
  return sceneHtml;  
}


// on window resize
$(window).resize(function(){
    windowH = $(window).height();
    $("#map").height(windowH);
    $("#infoWrapper").height(windowH); 
})