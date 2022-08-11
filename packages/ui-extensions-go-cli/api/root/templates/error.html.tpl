<!DOCTYPE html>
<html>

<head>
	<title>Error</title>
	<meta charset="UTF-8" />
</head>

<body>
	<div id="title">Error accessing the extension</div>
    
	<div id="description"> {{ .Error }}</div>
	<style>
		html {
			height: 100%;
			font-family: -apple-system,BlinkMacSystemFont,San Francisco,Segoe UI,Roboto,Helvetica Neue,sans-serif;
			font-size: 100%;
		}

		body {
			height: 100%;
			text-align: center;
			display: flex;
			flex-direction: column;
			justify-content: center;
		}

		#title {
			font-size: 1.5rem;
			line-height: 1.75rem;
			margin-bottom: 1rem;
		}

		#description {
			font-size: 0.875rem;
			line-height: 1.25rem;
		}
	</style>
</body>

</html>
