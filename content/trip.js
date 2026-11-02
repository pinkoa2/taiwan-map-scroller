// Everything on the page comes from here. Edit words, places and photos in
// this file; never in the components.
//
// A leg is one stop on the trip, in the order it happened.
//   name, zh     the place in English and Chinese (zh is optional)
//   at           [lat, lng] of the place (right-click in Google Maps to copy)
//   stay         how long we were there, free text ("4 days", "one night")
//   by           how we got here from the previous leg, as segments:
//                  { mode: 'train' | 'metro' | 'bus' | 'car' | 'walk' | 'flight' | 'ferry' | 'scooter',
//                    to: [lat, lng], toName: 'Ruifang' }   ← optional midpoint
//                    via: [[lat, lng], …]   ← optional: by road through these, in order
//                                             (the scooter loop round Xiaoliuqiu)
//                the last segment always ends at this leg's `at`.
//   arrive       for the first leg only: a word for how the trip began
//   when         the dates, free text ('Oct 12–14')
//   dayTrip      true for a trip out and back to a base (a day out, or longer):
//                after its photos the route draws back to the base, and the
//                next leg leaves from there
//   returnTo     a leg id: after this leg we went back there; drawn the same way.
//                A return visit gets no leg of its own; its photos go in the
//                first visit's folder.
//   back         how we went back (dayTrip or returnTo), as segments like `by`;
//                without it, the way out is retraced (leaving out a `via` loop
//                that ends where it starts)
//   text         a short write-up; blank lines start a new paragraph
//   view         how many km wide the map is when it zooms in here (default 16)
//   walk         a hike drawn on its own close-up (see Alishan); track: true
//                draws it as an old railway track under the footprints;
//                outAndBack: true walks it to the far end and back again;
//                stats: { source, figures: [[label, value]], splits: [[mile, pace, ft]] }
//                shown as a card beside the trail while it draws
//   hang         'lanterns' strings the place's photos together with red lanterns
//
// Photos and videos: content/media/<id>/ (a walk uses walk.folder), listed
// in that folder's photos.json, in order. Each entry:
//   { file, caption, comment, taken, pick, show, original, poster (videos) }
//   caption  a short line under the photo
//   comment  a longer note, shown when the photo is opened full screen
//   pick     true = one of the few shown by default; add ?display=all to the
//            page's address to see every photo
//   show     false hides it even from ?display=all, but keeps the file
//   original the name it had on the phone
// Leave photos.json alone for everything else; reorder its entries to reorder.

export default {
  title: 'Taiwan',
  titleZh: '臺灣',
  year: 2026,
  travellers: ['Alex', 'Ting'],
  summary: 'A month on the island, plotted as we went.',
  subdomain: 'taiwan.pinkoa2.lol',
  units: 'mi',
  // How each place's photos are shown.
  //   wide:  'deck'      a pile of prints beside the place; scrolling flips through them
  //          'scatter'   prints drop onto the map around the place as you scroll
  //          'mosaic'    a paper page over the map, one big photo then a grid
  //          'over-map'  photos float over the map in two columns down the edges
  //   phone: 'deck'      the same deck of prints, under the place, after its page
  //          'prints'    prints stacked down the page over the blurred map
  //          'mosaic'    the paper page with a two-across grid
  photoLayout: { wide: 'deck', phone: 'deck' },
  cover: 'jiufen/red-lantern-alley.jpg',

  legs: [
    {
      id: 'taipei',
      name: 'Taipei',
      zh: '臺北',
      at: [25.0479, 121.517],
      when: 'Oct 12–14, 16–17',
      arrive: 'Landed',
      // The flight in: a plane coming in off the map from the east.
      by: [{ mode: 'flight', from: [24.4, 123.95], fromName: 'the US' }],
      view: 22,
      text: 'Landed in Taipei and spent four days exploring the city.',
    },
    {
      id: 'tamsui',
      name: 'Tamsui',
      zh: '淡水',
      at: [25.1701, 121.4399],
      when: 'Oct 14',
      by: [{ mode: 'metro' }],
      // A day out from Taipei: the next leg leaves from Taipei again.
      dayTrip: true,
      text: 'An afternoon by the river in Tamsui.',
    },
    {
      id: 'shifen',
      name: 'Shifen',
      zh: '十分',
      at: [25.0411, 121.7752],
      when: 'Oct 15',
      by: [{ mode: 'train' }],
      text: 'Out of the city by train to Shifen.',
    },
    {
      id: 'jiufen',
      name: 'Jiufen',
      zh: '九份',
      at: [25.1095, 121.8453],
      when: 'Oct 15',
      by: [{ mode: 'train' }],
      text: 'On to Jiufen for the night.',
    },
    {
      id: 'shuinandong',
      name: 'Shuinandong',
      zh: '水湳洞',
      at: [25.1215, 121.8638],
      when: 'Oct 16',
      by: [{ mode: 'bus' }],
      view: 10,
      // Then back to Taipei for the night (those photos are in Taipei's): bus
      // then train, changing at Ruifang (the train tickets say Ruifang → Taipei).
      returnTo: 'taipei',
      back: [{ mode: 'bus', to: [25.109, 121.8066], toName: 'Ruifang' }, { mode: 'train' }],
      text: 'By bus to Shuinandong.',
    },
    {
      id: 'yunlin',
      name: 'Yunlin',
      zh: '雲林',
      // Dounan, where we stayed.
      at: [23.6741, 120.4768],
      // The 17th is when we went down (no photos that day); photos are from the
      // 19th. Back again from the 22nd after Alishan (photos on the 22nd and
      // 24th); those photos are here too.
      when: 'Oct 17–19, 22–24',
      by: [{ mode: 'train' }],
      view: 30,
      text: 'South by train to Yunlin.',
    },
    {
      id: 'sun-moon-lake',
      name: 'Sun Moon Lake',
      zh: '日月潭',
      at: [23.8564, 120.9112],
      when: 'Oct 18',
      by: [{ mode: 'car' }],
      // A day out from Yunlin.
      dayTrip: true,
      view: 20,
      text: 'A day trip by car to Sun Moon Lake.',
    },
    {
      id: 'alishan',
      name: 'Alishan',
      zh: '阿里山',
      at: [23.51, 120.8043],
      when: 'Oct 20–22',
      by: [{ mode: 'car' }],
      // Not a day out, but we came back to Yunlin after, so it's treated as
      // one. Back down by car via Chiayi city.
      dayTrip: true,
      back: [{ mode: 'car', to: [23.4795, 120.4497], toName: 'Chiayi' }, { mode: 'car' }],
      view: 24,
      text: 'Up into the mountains by car to Alishan.',
      walk: {
        name: 'Mianyue Line',
        zh: '眠月線',
        // Its photos live in content/media/mianyue-line/.
        folder: 'mianyue-line',
        when: 'Oct 21',
        // Drawn from OpenStreetMap: the ways named 眠月線.
        osmName: '眠月線',
        // An old railway line: drawn as a track under the footprints.
        track: true,
        // Out to the far end and back the same way.
        outAndBack: true,
        // Shown beside the trail while the footsteps draw, as a card. Copied
        // from the AllTrails recording (content/media/mianyue-line/alltrails-mianyue-line.jpg).
        stats: {
          source: 'AllTrails',
          figures: [
            ['Length', '10.15 mi'],
            ['Elev. gain', '1,522 ft'],
            ['Moving time', '4:50:22'],
            ['Avg. pace', '28:37'],
            ['Calories', '2,518'],
            ['Total time', '6:11:01'],
          ],
          // [mile, pace, elevation gain in ft]
          splits: [
            ['1', '32:53', 253],
            ['2', '32:00', 98],
            ['3', '24:04', 285],
            ['4', '30:56', 180],
            ['5', '25:40', 62],
            ['6', '28:56', 59],
            ['7', '25:27', 236],
            ['8', '23:11', 148],
            ['9', '27:15', 108],
            ['10', '34:53', 43],
            ['10.1', '35:02', 43],
          ],
        },
        miles: 10,
        hours: 6,
        text: 'About ten miles and six hours along the old Mianyue railway line, and a little dangerous in places. The highlight of the trip for me.',
        by: 'Alex',
      },
    },
    {
      id: 'kaohsiung',
      name: 'Kaohsiung',
      zh: '高雄',
      // Where we stayed: from the view out of the window on the 25th (inferred).
      at: [22.6737, 120.3083],
      // Back again on the 30th after Tainan, and on Nov 1 after Xiaoliuqiu.
      when: 'Oct 25–27, 30, Nov 1',
      by: [{ mode: 'car' }],
      // Wide enough to take in Fo Guang Shan, out to the east.
      view: 34,
      text: 'By car to Kaohsiung.',
    },
    {
      id: 'tainan',
      name: 'Tainan',
      zh: '臺南',
      at: [22.9915, 120.2045],
      when: 'Oct 28–30',
      by: [{ mode: 'car' }],
      // Back to Kaohsiung after (the way back is assumed to be by car too).
      dayTrip: true,
      view: 18,
      text: 'By car to Tainan.',
    },
    {
      id: 'xiaoliuqiu',
      name: 'Xiaoliuqiu',
      zh: '小琉球',
      // Baisha harbour, by Vase Rock (from the photos' GPS).
      at: [22.3543, 120.3815],
      when: 'Oct 31 – Nov 1',
      // Car to the Donggang pier (photo there at 12:16), the ferry across, then
      // round the island by scooter: through the turtle coast, Sunset Pavilion,
      // the south harbour and the east reef (spots from the photos' GPS; the
      // roads between are OSRM's), back to Baisha.
      by: [
        { mode: 'car', to: [22.4685, 120.4447], toName: 'Donggang' },
        { mode: 'ferry', to: [22.3543, 120.3815], toName: 'Baisha' },
        { mode: 'scooter', via: [[22.3530, 120.3714], [22.3298, 120.3544], [22.3365, 120.3765], [22.3395, 120.3817]] },
      ],
      // Back to Kaohsiung after: the ferry and the car again, retraced (a loop
      // like the scooter's is left out of the way back).
      dayTrip: true,
      // Close in, like the scooter loop's close-up, so the photos don't zoom back out.
      view: 5,
      text: 'By car to Donggang, the ferry across, then by scooter, kind of all around the island.',
    },
  ],

  // The way home, after the last place (and its way back to base): on stop by
  // stop, then the flight out, drawn over open map with no card or photos
  // (photos from a stop go in that place's folder). Each hop:
  //   { to: '<leg id>' | [lat, lng], toName (for a point), by (segments, as a leg's) }
  // Kaohsiung → Yunlin → Taipei → home (the user, Nov 2, 2026). The car and
  // the train are assumed: the ways we came.
  home: [
    { to: 'yunlin', by: [{ mode: 'car' }] },
    { to: 'taipei', by: [{ mode: 'train' }] },
    // Off the map to the east, the way the plane came in.
    { to: [24.4, 123.95], toName: 'Home', by: [{ mode: 'flight' }] },
  ],

  // Shown at the end while the trip is still going (e.g. 'To be continued').
  // Off since Nov 2, 2026: the user asked, and will add the last legs as they go.
  continues: null,

  // The full album (every photo, not just the picks): linked from the closing
  // card and the foot of the stop list. Set to null to hide it.
  album: 'https://photos.app.goo.gl/KQkQWtRiSuorU4vr9',
}
