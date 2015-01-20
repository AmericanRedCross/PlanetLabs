$('#key-request').modal(options);

var key = "";

function keysubmit(){
  key = ($('#input-api-key').val());
  $('#key-request').modal('hide');
}

// add a function to test the key
    


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

// formatting the scene search output for pretty reading and adding as html to page
function output(inp) {
    d3.select("#scenes-list").append('pre').html(inp);
}
function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// planet labs API scene search
function searchScenes(aoi){
  //clear past search results from html page
  $("#scenes-list").empty();
  //planet labs url
  var url = "https://api.planet.com/v0/scenes/ortho/";
  // stringigy the polygon search area drawn to leaflet map
  var intersects = JSON.stringify(aoi);
  // set search parameters
  var params = {
    intersects: intersects,
    order_by: 'acquired desc', // order newest to oldest
    count: 1000, // set number of possible results to maximum
  };
  // request scenes with Jquery
  // API authorization key needs to be set/loaded from js/APIkey.js
  var auth = "Basic " + btoa(key + ":");
  $.ajax({
      url: url,
      data: params,
      headers: {
          "Authorization": auth
      },
      success: function(data) {
          // do something with data.features here

          // log number of results displayed
          d3.select("#scenes-list").append('div').html(data.features.length + " results");

          // show only part of the results for each feature
          $.each(data.features, function(index, feature){
            var str = JSON.stringify(feature.properties, undefined, 4);
            output(syntaxHighlight(str));
          });

          // or use the followign to show everything
          // output(syntaxHighlight(JSON.stringify(data.features, undefined, 4)));

      },
  });
}